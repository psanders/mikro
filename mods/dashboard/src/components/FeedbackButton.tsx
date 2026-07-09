/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * In-app feedback (mikro/#69): click the feedback icon → consent → record →
 * click the floating pill's stop button → upload. Feedback is generic — a bug,
 * something confusing, or an idea. The apiserver transcribes (when there's
 * audio), structures, and files a GitHub issue with the video attached — see
 * createSubmitFeedback.ts. No screenshot is captured at all anymore: the video
 * is strictly more useful (it's the whole reason we did the native-capture
 * work), so it's the default and only visual now. The result screen doesn't
 * show the issue link either: the target repos are going private, so users
 * (who won't have repo access) just get a "the team will review it" message
 * instead.
 *
 * Capture source (extend-bug-report-native-capture): WKWebView on macOS
 * doesn't implement `getDisplayMedia`, so the Tauri build can't grab a live
 * screen stream the way a real browser (or Windows Tauri, via WebView2) can.
 * Selection is by feature detection, not a Tauri/OS check —
 * `hasDisplayMedia()` true covers web AND Windows Tauri (real screen+mic
 * video, muxed by the browser's own MediaRecorder); false means the Tauri
 * native path — a silent screen-only video via ScreenCaptureKit
 * (`start_feedback_recording`/`stop_feedback_recording`). ScreenCaptureKit
 * itself can't capture the mic (only system/app audio output), and muxing a
 * mic track into the video would need a bundled/signed ffmpeg — out of
 * scope. Instead (mikro/#156) the Tauri path records mic-only narration
 * audio in parallel via `getUserMedia({ audio: true })` + `MediaRecorder`,
 * same as the browser path's mic track, and submits it as a separate
 * `audioBase64` field alongside the silent video — createSubmitFeedback.ts
 * transcribes that instead of the (silent) video when it's present.
 *
 * The "recording" stage renders a floating, non-blocking pill (not a
 * full-screen modal) so the user can navigate the dashboard while recording
 * to demonstrate a multi-page issue — matching the mobile app's pill, and
 * fixing a real limitation the original full-screen-modal design had even on
 * web.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Circle, Check } from "lucide-react";
import {
  submitFeedbackWithRetry,
  toSpanishFeedbackError
} from "@mikro/common/utils/feedbackSubmit";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/Button";
import { Tooltip } from "./ui/Tooltip";
import { RecordingPill } from "./RecordingPill";

type Stage = "idle" | "consent" | "recording" | "processing" | "result" | "error";
type CaptureMode = "browser" | "tauri-native";

/** Captured video plus optional mic-only narration audio (mikro/#156), same shape `submit.mutateAsync` expects. */
type PendingRecording = {
  base64: string;
  mimeType: string;
  audioBase64?: string;
  audioMimeType?: string;
};

const hasDisplayMedia = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function blobToBase64(blob: Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
      if (!match) {
        reject(new Error("Unexpected data URL format"));
        return;
      }
      resolve({ mimeType: match[1]!, base64: match[2]! });
    };
    reader.readAsDataURL(blob);
  });
}

/** RailItem-shaped button so it drops into FounderShell's nav rail without a new pattern. */
export function FeedbackButton() {
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const captureModeRef = useRef<CaptureMode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The captured recording is kept after a submit failure so "Intentar de
  // nuevo" re-sends the same bytes instead of forcing a fresh recording
  // (mikro/#97). Null means nothing has been captured (or it already sent).
  const pendingRecordingRef = useRef<PendingRecording | null>(null);

  const submit = trpc.submitFeedback.useMutation();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const cleanupStreams = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
    micStreamRef.current = null;
    recorderRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cleanupStreams();
    clearTimer();
    chunksRef.current = [];
    captureModeRef.current = null;
    pendingRecordingRef.current = null;
    setElapsedSeconds(0);
    setErrorMessage(null);
    setStage("idle");
  }, [cleanupStreams, clearTimer]);

  const startBrowserRecording = useCallback(async () => {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    displayStreamRef.current = displayStream;
    micStreamRef.current = micStream;

    const combined = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...micStream.getAudioTracks()
    ]);
    const recorder = new MediaRecorder(combined, { mimeType: "video/webm" });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();

    // If the user stops sharing from the browser's own "Stop sharing" UI
    // instead of our pill, wind down the same way.
    displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (recorderRef.current?.state === "recording") void stopRecording();
    });
  }, []);

  // Tauri build only (WKWebView has no `getDisplayMedia`): a silent
  // screen-only video recording via ScreenCaptureKit, plus mic-only
  // narration audio captured in parallel (mikro/#156) — see this file's
  // header. The mic is acquired first: if permission is denied, nothing
  // native has started yet, so the caller's catch block can clean up with
  // a plain `cleanupStreams()` — no orphaned ScreenCaptureKit session to
  // stop.
  const startTauriRecording = useCallback(async () => {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = micStream;
    const recorder = new MediaRecorder(micStream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();

    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("start_feedback_recording");
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (hasDisplayMedia()) {
        captureModeRef.current = "browser";
        await startBrowserRecording();
      } else if (isTauri()) {
        captureModeRef.current = "tauri-native";
        await startTauriRecording();
      } else {
        throw new Error("La grabación no está disponible en este navegador.");
      }
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
      setStage("recording");
    } catch {
      cleanupStreams();
      // No raw message: getDisplayMedia/getUserMedia throw English strings,
      // and this is a Spanish-only UI (mikro/#97).
      setErrorMessage(
        "No se pudo iniciar la grabación. Revisa los permisos de pantalla y micrófono."
      );
      setStage("error");
    }
  }, [cleanupStreams, startBrowserRecording, startTauriRecording]);

  // Submits the captured recording, retrying transient failures (network blip,
  // rate limit, 5xx) with the same bytes before giving up. Keeps the recording
  // in `pendingRecordingRef` until it actually lands so a manual retry can
  // re-send it without re-recording.
  const finishSubmit = useCallback(
    async (recording: PendingRecording) => {
      pendingRecordingRef.current = recording;
      await submitFeedbackWithRetry(() =>
        submit.mutateAsync({
          videoBase64: recording.base64,
          videoMimeType: recording.mimeType,
          audioBase64: recording.audioBase64,
          audioMimeType: recording.audioMimeType,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent
        })
      );
      pendingRecordingRef.current = null;
      setStage("result");
    },
    [submit]
  );

  const stopBrowserRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    await new Promise<void>((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const recordingBlob = new Blob(chunksRef.current, { type: "video/webm" });
          cleanupStreams();
          const recording64 = await blobToBase64(recordingBlob);
          await finishSubmit(recording64);
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error("No se pudo enviar el feedback."));
        }
      };
      recorder.stop();
    });
  }, [cleanupStreams, finishSubmit]);

  const stopTauriRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    const audioBlob = await new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state !== "recording") {
        resolve(null);
        return;
      }
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.stop();
    });
    cleanupStreams();

    const { invoke } = await import("@tauri-apps/api/core");
    const recording = await invoke<{ base64: string; mimeType: string }>("stop_feedback_recording");
    const audio = audioBlob ? await blobToBase64(audioBlob) : null;
    await finishSubmit({
      ...recording,
      audioBase64: audio?.base64,
      audioMimeType: audio?.mimeType
    });
  }, [cleanupStreams, finishSubmit]);

  const stopRecording = useCallback(async () => {
    clearTimer();
    setStage("processing");
    try {
      if (captureModeRef.current === "tauri-native") {
        await stopTauriRecording();
      } else {
        await stopBrowserRecording();
      }
    } catch (err) {
      cleanupStreams();
      setErrorMessage(toSpanishFeedbackError(err));
      setStage("error");
    }
  }, [clearTimer, cleanupStreams, stopBrowserRecording, stopTauriRecording]);

  // "Intentar de nuevo" after a submit failure: re-send the recording we still
  // hold rather than throwing it away and re-recording (mikro/#97). If the
  // failure happened before anything was captured (e.g. starting the recording
  // failed), fall back to the consent screen to record fresh.
  const retrySubmit = useCallback(async () => {
    const pending = pendingRecordingRef.current;
    if (!pending) {
      setErrorMessage(null);
      setStage("consent");
      return;
    }
    setStage("processing");
    try {
      await finishSubmit(pending);
    } catch (err) {
      setErrorMessage(toSpanishFeedbackError(err));
      setStage("error");
    }
  }, [finishSubmit]);

  // Abandon the in-progress recording without submitting anything. Stops the
  // recorder/streams (or the native ScreenCaptureKit session) and throws the
  // captured bytes away, landing straight back at idle. Kept inside the pill so
  // there's no extra confirm modal — a mis-tap just means re-recording.
  const discardRecording = useCallback(async () => {
    clearTimer();
    try {
      if (captureModeRef.current === "tauri-native") {
        // Stop the mic recorder (mikro/#156) and the native session so
        // ScreenCaptureKit releases the screen, but ignore both results —
        // nothing is submitted.
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.onstop = null;
          recorder.ondataavailable = null;
          recorder.stop();
        }
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("stop_feedback_recording");
      } else {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          // Detach the submit-on-stop handler before stopping so cleanup below
          // is the only thing that runs.
          recorder.onstop = null;
          recorder.ondataavailable = null;
          recorder.stop();
        }
      }
    } catch {
      // Best-effort: discarding must always return the UI to idle.
    } finally {
      reset();
    }
  }, [clearTimer, reset]);

  return (
    <>
      <Tooltip label="Enviar feedback">
        <button
          type="button"
          onClick={() => stage === "idle" && setStage("consent")}
          aria-label="Enviar feedback"
          className="relative flex h-10 w-10 items-center justify-center rounded-[11px] text-[#697A93] transition hover:bg-[#EEF3F9]"
        >
          <MessageSquare size={19} strokeWidth={2} />
        </button>
      </Tooltip>

      {stage === "recording" && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-end px-6 pointer-events-none">
          <RecordingPill
            elapsedSeconds={elapsedSeconds}
            onStop={() => void stopRecording()}
            onDiscard={() => void discardRecording()}
          />
        </div>
      )}

      {stage !== "idle" && stage !== "recording" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[14px] bg-white p-6 shadow-xl">
            {stage === "consent" && (
              <>
                <h2 className="text-[16px] font-semibold text-[#14254A]">Enviar feedback</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Esto va a grabar tu pantalla mientras muestras lo que quieres compartir — un
                  problema, algo confuso o una idea. La grabación se usa solo para crear el reporte
                  y no se guarda de forma permanente. Evita mostrar datos sensibles de clientes si
                  es posible.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={reset}>
                    Cancelar
                  </Button>
                  <Button variant="primary" icon={Circle} onClick={() => void startRecording()}>
                    Empezar a grabar
                  </Button>
                </div>
              </>
            )}

            {stage === "processing" && (
              <>
                <h2 className="text-[16px] font-semibold text-[#14254A]">Enviando feedback…</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Enviando tu feedback al equipo. Esto puede tardar un momento.
                </p>
              </>
            )}

            {stage === "result" && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D6F3E5]">
                  <Check size={26} className="text-[#0E7C5F]" strokeWidth={2.5} />
                </div>
                <h2 className="mt-3 text-[16px] font-semibold text-[#14254A]">Feedback enviado</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Gracias por tu feedback. Nuestro equipo lo va a revisar y priorizar.
                </p>
                <div className="mt-5 flex justify-end">
                  <Button variant="primary" onClick={reset}>
                    Cerrar
                  </Button>
                </div>
              </>
            )}

            {stage === "error" && (
              <>
                <h2 className="text-[16px] font-semibold text-[#14254A]">No se pudo enviar</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#DC2626]">{errorMessage}</p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={reset}>
                    Cerrar
                  </Button>
                  <Button variant="primary" onClick={() => void retrySubmit()}>
                    Intentar de nuevo
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

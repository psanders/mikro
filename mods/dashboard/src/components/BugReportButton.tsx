/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * In-app bug report (mikro/#69): click the bug icon → consent → record →
 * click the floating pill's stop button → upload. The apiserver transcribes
 * (when there's audio), structures, and files a GitHub issue with the video
 * attached — see createSubmitBugReport.ts. No screenshot is captured at all
 * anymore: the video is strictly more useful (it's the whole reason we did
 * the native-capture work), so it's the default and only visual now. The
 * result screen doesn't show the issue link either: the target repos are
 * going private, so reporters (who won't have repo access) just get a "the
 * team will review it" message instead.
 *
 * Capture source (extend-bug-report-native-capture): WKWebView on macOS
 * doesn't implement `getDisplayMedia`, so the Tauri build can't grab a live
 * screen stream the way a real browser (or Windows Tauri, via WebView2) can.
 * Selection is by feature detection, not a Tauri/OS check —
 * `hasDisplayMedia()` true covers web AND Windows Tauri (real screen+mic
 * video, muxed by the browser's own MediaRecorder); false means the Tauri
 * native path — a silent screen-only video via ScreenCaptureKit
 * (`start_bug_report_recording`/`stop_bug_report_recording`), no microphone
 * at all. ScreenCaptureKit can't capture the mic (only system/app audio
 * output), and muxing a separate mic track in would need a bundled/signed
 * ffmpeg — real distribution scope for a video whose point is "show what
 * happened," not narration.
 *
 * The "recording" stage renders a floating, non-blocking pill (not a
 * full-screen modal) so the user can navigate the dashboard while recording
 * to demonstrate a multi-page bug — matching the mobile app's pill, and
 * fixing a real limitation the original full-screen-modal design had even on
 * web.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Bug, Circle, Check } from "lucide-react";
import {
  submitBugReportWithRetry,
  toSpanishBugReportError
} from "@mikro/common/utils/bugReportSubmit";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/Button";
import { RecordingPill } from "./RecordingPill";

type Stage = "idle" | "consent" | "recording" | "processing" | "result" | "error";
type CaptureMode = "browser" | "tauri-native";

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
export function BugReportButton() {
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
  const pendingRecordingRef = useRef<{ base64: string; mimeType: string } | null>(null);

  const submit = trpc.submitBugReport.useMutation();

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
  // screen-only video recording via ScreenCaptureKit. No mic — see this
  // file's header for why.
  const startTauriRecording = useCallback(async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("start_bug_report_recording");
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
    async (recording: { base64: string; mimeType: string }) => {
      pendingRecordingRef.current = recording;
      await submitBugReportWithRetry(() =>
        submit.mutateAsync({
          videoBase64: recording.base64,
          videoMimeType: recording.mimeType,
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
          reject(err instanceof Error ? err : new Error("No se pudo enviar el reporte."));
        }
      };
      recorder.stop();
    });
  }, [cleanupStreams, finishSubmit]);

  const stopTauriRecording = useCallback(async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const recording = await invoke<{ base64: string; mimeType: string }>(
      "stop_bug_report_recording"
    );
    await finishSubmit(recording);
  }, [finishSubmit]);

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
      setErrorMessage(toSpanishBugReportError(err));
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
      setErrorMessage(toSpanishBugReportError(err));
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
        // Stop the native session so ScreenCaptureKit releases the screen, but
        // ignore the returned recording — nothing is submitted.
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("stop_bug_report_recording");
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
      <button
        type="button"
        onClick={() => stage === "idle" && setStage("consent")}
        aria-label="Reportar un problema"
        title="Reportar un problema"
        className="relative flex h-10 w-10 items-center justify-center rounded-[11px] text-[#697A93] transition hover:bg-[#EEF3F9]"
      >
        <Bug size={19} strokeWidth={2} />
      </button>

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
                <h2 className="text-[16px] font-semibold text-[#14254A]">Reportar un problema</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Esto va a grabar tu pantalla mientras muestras el problema. La grabación se usa
                  solo para crear el reporte — no se guarda de forma permanente. Evita mostrar datos
                  sensibles de clientes si es posible.
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
                <h2 className="text-[16px] font-semibold text-[#14254A]">Enviando reporte…</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Creando el reporte en GitHub. Esto puede tardar un momento.
                </p>
              </>
            )}

            {stage === "result" && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D6F3E5]">
                  <Check size={26} className="text-[#0E7C5F]" strokeWidth={2.5} />
                </div>
                <h2 className="mt-3 text-[16px] font-semibold text-[#14254A]">Reporte enviado</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Gracias por tu reporte. Nuestro equipo lo va a revisar, priorizar y corregir.
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

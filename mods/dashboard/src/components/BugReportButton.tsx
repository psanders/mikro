/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * In-app bug report (mikro/#69): click the bug icon → consent → record
 * screen + mic → click again to stop → upload. The apiserver transcribes,
 * structures, and files a GitHub issue; nothing is stored on our side (see
 * createSubmitBugReport.ts) — the recording lives only in this component's
 * memory for the few seconds it takes to stop, screenshot, and upload it.
 *
 * Capture source (extend-bug-report-native-capture): WKWebView on macOS
 * doesn't implement `getDisplayMedia`, so the Tauri build can't grab a live
 * screen stream the way a real browser (or Windows Tauri, via WebView2) can.
 * Selection is by feature detection, not a Tauri/OS check — `hasDisplayMedia()`
 * true covers web AND Windows Tauri; false means the Tauri native path (mic
 * audio + a single native screenshot via the `capture_bug_report_screenshot`
 * command) if we're actually inside Tauri, otherwise the browser just doesn't
 * support this feature at all.
 */
import { useCallback, useRef, useState } from "react";
import { Bug, Circle, Square, X, ExternalLink } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/Button";

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
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureModeRef = useRef<CaptureMode | null>(null);
  const nativeScreenshotRef = useRef<{ base64: string; mimeType: string } | null>(null);

  const submit = trpc.submitBugReport.useMutation();

  const cleanupStreams = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
    micStreamRef.current = null;
    recorderRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cleanupStreams();
    chunksRef.current = [];
    captureModeRef.current = null;
    nativeScreenshotRef.current = null;
    setIssueUrl(null);
    setErrorMessage(null);
    setStage("idle");
  }, [cleanupStreams]);

  const startBrowserRecording = useCallback(async () => {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    displayStreamRef.current = displayStream;
    micStreamRef.current = micStream;

    // Hidden preview element so we can grab a still frame from the live
    // screen track when recording stops (no ImageCapture dependency).
    const video = document.createElement("video");
    video.srcObject = displayStream;
    video.muted = true;
    await video.play();
    previewVideoRef.current = video;

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
    // instead of our button, wind down the same way.
    displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (recorderRef.current?.state === "recording") stopRecording();
    });
  }, []);

  // Tauri build only (WKWebView has no `getDisplayMedia`): grab one native
  // screenshot up front instead of a live screen stream, then record mic
  // audio only. The screenshot + audio go through the same submitBugReport
  // shape the browser path uses — see BugReportButton.tsx's file header and
  // design.md (extend-bug-report-native-capture) for why this isn't a full
  // muxed screen+audio video today.
  const startTauriRecording = useCallback(async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const screenshot = await invoke<{ base64: string; mimeType: string }>(
      "capture_bug_report_screenshot"
    );
    nativeScreenshotRef.current = screenshot;

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = micStream;

    const recorder = new MediaRecorder(micStream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();
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
      setStage("recording");
    } catch (err) {
      cleanupStreams();
      setErrorMessage(
        err instanceof Error
          ? `No se pudo iniciar la grabación: ${err.message}`
          : "No se pudo iniciar la grabación."
      );
      setStage("error");
    }
  }, [cleanupStreams, startBrowserRecording, startTauriRecording]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    setStage("processing");

    recorder.onstop = async () => {
      try {
        let screenshot: { base64: string; mimeType: string } | null = null;
        let recordingBlob: Blob;

        if (captureModeRef.current === "tauri-native") {
          // Screenshot was already captured natively when recording started;
          // the recorder here only ever held mic audio.
          screenshot = nativeScreenshotRef.current;
          recordingBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        } else {
          recordingBlob = new Blob(chunksRef.current, { type: "video/webm" });

          // Grab a still frame before tearing down the tracks.
          const video = previewVideoRef.current;
          if (video && video.videoWidth > 0) {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const screenshotBlob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, "image/png")
            );
            if (screenshotBlob) screenshot = await blobToBase64(screenshotBlob);
          }
        }

        cleanupStreams();

        const recording64 = await blobToBase64(recordingBlob);
        const result = await submit.mutateAsync({
          videoBase64: recording64.base64,
          videoMimeType: recording64.mimeType,
          screenshotBase64: screenshot?.base64 ?? "",
          screenshotMimeType: screenshot?.mimeType ?? "image/png",
          pageUrl: window.location.href,
          userAgent: navigator.userAgent
        });

        setIssueUrl(result.issueUrl);
        setStage("result");
      } catch (err) {
        cleanupStreams();
        setErrorMessage(err instanceof Error ? err.message : "No se pudo enviar el reporte.");
        setStage("error");
      }
    };
    recorder.stop();
  }, [cleanupStreams, submit]);

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

      {stage !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[14px] bg-white p-6 shadow-xl">
            {stage === "consent" && (
              <>
                <h2 className="text-[16px] font-bold text-[#14254A]">Reportar un problema</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Esto va a grabar tu pantalla y tu voz mientras describes el problema. La grabación
                  se transcribe automáticamente y se usa solo para crear el reporte — no se guarda
                  en nuestros servidores. Evita mostrar datos sensibles de clientes si es posible.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={reset}>
                    Cancelar
                  </Button>
                  <Button variant="primary" icon={Circle} onClick={startRecording}>
                    Empezar a grabar
                  </Button>
                </div>
              </>
            )}

            {stage === "recording" && (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#DC2626]" />
                  <h2 className="text-[16px] font-bold text-[#14254A]">Grabando…</h2>
                </div>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Describe el problema en voz alta mientras lo muestras en pantalla. Toca "Detener y
                  enviar" cuando termines.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" icon={X} onClick={reset}>
                    Descartar
                  </Button>
                  <Button variant="primary" icon={Square} onClick={stopRecording}>
                    Detener y enviar
                  </Button>
                </div>
              </>
            )}

            {stage === "processing" && (
              <>
                <h2 className="text-[16px] font-bold text-[#14254A]">Enviando reporte…</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Transcribiendo y creando el reporte en GitHub. Esto puede tardar un momento.
                </p>
              </>
            )}

            {stage === "result" && issueUrl && (
              <>
                <h2 className="text-[16px] font-bold text-[#14254A]">Reporte enviado</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#697A93]">
                  Se creó el reporte. Puedes darle seguimiento en el enlace de abajo.
                </p>
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center gap-2 text-[13px] font-medium text-[#1F4AA8] hover:underline"
                >
                  {issueUrl}
                  <ExternalLink size={14} />
                </a>
                <div className="mt-5 flex justify-end">
                  <Button variant="primary" onClick={reset}>
                    Cerrar
                  </Button>
                </div>
              </>
            )}

            {stage === "error" && (
              <>
                <h2 className="text-[16px] font-bold text-[#14254A]">No se pudo enviar</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#DC2626]">{errorMessage}</p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={reset}>
                    Cerrar
                  </Button>
                  <Button variant="primary" onClick={() => setStage("consent")}>
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

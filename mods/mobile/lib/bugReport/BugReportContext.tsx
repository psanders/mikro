/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Global bug-report recording state (mikro/#69, extend-bug-report-native-capture).
 * Lives at the root layout so the floating recording pill and status modal
 * stay mounted across navigation — the whole point of the pill is that users
 * can move to any other screen while recording continues.
 *
 * Platform asymmetry (confirmed against react-native-nitro-screen-recorder's
 * real docs, not assumed): iOS uses `startInAppRecording`/`stopInAppRecording`
 * (records only this app's content). Android has no in-app-only mode in this
 * library — `MediaProjection` fundamentally mirrors the whole device screen —
 * so Android uses `startGlobalRecording`/`stopGlobalRecording`, which captures
 * system-wide content (other apps, notifications) if the user switches away
 * while recording. The consent copy in BugReportConsentModal calls this out
 * on Android specifically. See design.md (Decision 3) for the full rationale.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { File } from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
  startInAppRecording,
  stopInAppRecording,
  cancelInAppRecording,
  startGlobalRecording,
  stopGlobalRecording,
  getMicrophonePermissionStatus,
  requestMicrophonePermission,
  type ScreenRecordingFile
} from "react-native-nitro-screen-recorder";
import { trpc } from "../api";
import { BugReportPill } from "../../components/bugReport/BugReportPill";
import { BugReportStatusModal } from "../../components/bugReport/BugReportStatusModal";
import { finishBugReportRecording } from "./finishBugReportRecording";

export type BugReportStage = "idle" | "recording" | "processing" | "result" | "error";

interface BugReportContextValue {
  stage: BugReportStage;
  issueUrl: string | null;
  errorMessage: string | null;
  elapsedSeconds: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  discardRecording: () => Promise<void>;
  reset: () => void;
}

const BugReportContext = createContext<BugReportContextValue | null>(null);

/** Falls back to a real screenshot the server schema requires — the video's
 * own first frame, since mobile has no equivalent to a native OS screenshot
 * API the way the Tauri build does. */
async function extractScreenshot(videoPath: string): Promise<{ base64: string; mimeType: string }> {
  const { uri } = await VideoThumbnails.getThumbnailAsync(videoPath, { time: 0, quality: 0.8 });
  const base64 = await new File(uri).base64();
  return { base64, mimeType: "image/jpeg" };
}

export function BugReportProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<BugReportStage>("idle");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submit = trpc.submitBugReport.useMutation();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setElapsedSeconds(0);
    setIssueUrl(null);
    setErrorMessage(null);
    setStage("idle");
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    try {
      if (getMicrophonePermissionStatus() !== "granted") {
        const response = await requestMicrophonePermission();
        if (!response.granted) {
          throw new Error("Se requiere permiso de micrófono para grabar el reporte.");
        }
      }

      if (Platform.OS === "ios") {
        await startInAppRecording({
          options: { enableCamera: false, enableMic: true },
          onRecordingFinished: () => {}
        });
      } else {
        // startGlobalRecording is fire-and-forget (void, not a Promise); a
        // failure to start (e.g. the user declines Android's system capture
        // prompt) surfaces asynchronously through onRecordingError, not a
        // thrown exception here.
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          startGlobalRecording({
            options: { enableMic: true },
            onRecordingError: (error) => {
              if (!settled) {
                settled = true;
                reject(new Error(error.message));
              }
            }
          });
          setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve();
            }
          }, 300);
        });
      }

      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
      setStage("recording");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `No se pudo iniciar la grabación: ${err.message}`
          : "No se pudo iniciar la grabación."
      );
      setStage("error");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    clearTimer();
    setStage("processing");
    try {
      const file: ScreenRecordingFile | undefined =
        Platform.OS === "ios" ? await stopInAppRecording() : await stopGlobalRecording();

      const result = await finishBugReportRecording(file, {
        readBase64: (path) => new File(path).base64(),
        extractScreenshot,
        submit: (input) => submit.mutateAsync(input),
        platform: Platform.OS
      });

      setIssueUrl(result.issueUrl);
      setStage("result");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo enviar el reporte.");
      setStage("error");
    }
  }, [clearTimer, submit]);

  const discardRecording = useCallback(async () => {
    clearTimer();
    try {
      if (Platform.OS === "ios") {
        await cancelInAppRecording();
      } else {
        await stopGlobalRecording();
      }
    } finally {
      reset();
    }
  }, [clearTimer, reset]);

  return (
    <BugReportContext.Provider
      value={{
        stage,
        issueUrl,
        errorMessage,
        elapsedSeconds,
        startRecording,
        stopRecording,
        discardRecording,
        reset
      }}
    >
      {children}
      <BugReportPill />
      <BugReportStatusModal />
    </BugReportContext.Provider>
  );
}

export function useBugReport(): BugReportContextValue {
  const ctx = useContext(BugReportContext);
  if (!ctx) throw new Error("useBugReport must be used within a BugReportProvider");
  return ctx;
}

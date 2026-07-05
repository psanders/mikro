/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Global feedback recording state (mikro/#69, extend-bug-report-native-capture).
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
 * while recording. The consent copy in FeedbackConsentModal calls this out
 * on Android specifically. See design.md (Decision 3) for the full rationale.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { File } from "expo-file-system";
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
import {
  submitFeedbackWithRetry,
  toSpanishFeedbackError
} from "@mikro/common/utils/feedbackSubmit";
import { trpc } from "../api";
import { FeedbackPill } from "../../components/feedback/FeedbackPill";
import { FeedbackStatusModal } from "../../components/feedback/FeedbackStatusModal";
import { finishFeedbackRecording, type FeedbackSubmissionInput } from "./finishFeedbackRecording";

export type FeedbackStage = "idle" | "recording" | "processing" | "result" | "error";

interface FeedbackContextValue {
  stage: FeedbackStage;
  issueUrl: string | null;
  errorMessage: string | null;
  elapsedSeconds: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  retrySubmit: () => Promise<void>;
  discardRecording: () => Promise<void>;
  reset: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<FeedbackStage>("idle");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The captured submission is kept after a failure so "Intentar de nuevo"
  // re-sends the same recording instead of forcing a fresh one (mikro/#97).
  const pendingInputRef = useRef<FeedbackSubmissionInput | null>(null);
  const submit = trpc.submitFeedback.useMutation();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    pendingInputRef.current = null;
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
          throw new Error("Se requiere permiso de micrófono para grabar el feedback.");
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
    } catch {
      // No raw message: the native recorder / permission APIs throw English
      // strings, and this is a Spanish-only UI (mikro/#97).
      setErrorMessage(
        "No se pudo iniciar la grabación. Revisa los permisos de pantalla y micrófono."
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

      const result = await finishFeedbackRecording(file, {
        readBase64: (path) => new File(path).base64(),
        // Capture the exact submission for a manual retry (no re-record/re-read)
        // and retry transient failures with the same recording (mikro/#97).
        submit: (input) => {
          pendingInputRef.current = input;
          return submitFeedbackWithRetry(() => submit.mutateAsync(input));
        },
        platform: Platform.OS
      });

      pendingInputRef.current = null;
      setIssueUrl(result.issueUrl);
      setStage("result");
    } catch (err) {
      setErrorMessage(toSpanishFeedbackError(err));
      setStage("error");
    }
  }, [clearTimer, submit]);

  // "Intentar de nuevo" after a submit failure: re-send the recording we still
  // hold rather than throwing it away and re-recording (mikro/#97). If nothing
  // was captured (e.g. the recording never produced a file), record fresh.
  const retrySubmit = useCallback(async () => {
    const input = pendingInputRef.current;
    if (!input) {
      await startRecording();
      return;
    }
    setStage("processing");
    try {
      const result = await submitFeedbackWithRetry(() => submit.mutateAsync(input));
      pendingInputRef.current = null;
      setIssueUrl(result.issueUrl);
      setStage("result");
    } catch (err) {
      setErrorMessage(toSpanishFeedbackError(err));
      setStage("error");
    }
  }, [startRecording, submit]);

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
    <FeedbackContext.Provider
      value={{
        stage,
        issueUrl,
        errorMessage,
        elapsedSeconds,
        startRecording,
        stopRecording,
        retrySubmit,
        discardRecording,
        reset
      }}
    >
      {/* Explicit full-screen View (not a bare Fragment) so FeedbackPill's
          `position: "absolute"` always has a definite, full-screen
          containing block to resolve against, regardless of what any
          ancestor provider does. */}
      <View style={styles.root}>
        {children}
        <FeedbackPill />
        <FeedbackStatusModal />
      </View>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within a FeedbackProvider");
  return ctx;
}

const styles = StyleSheet.create({
  root: { flex: 1 }
});

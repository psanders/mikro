/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Presentational recording pill (Pencil node `Fd5n7` inside `s3PxMk`). Pure —
 * takes the elapsed time and the stop/discard callbacks and renders the pill
 * body only; the floating `fixed` positioning + capture state machine live in
 * `FeedbackButton`. Split out so the visual can be exercised in Storybook
 * without a live MediaRecorder session, and to keep exact parity with the
 * mobile app's `RecordingPill` (same props: elapsedSeconds / onStop /
 * onDiscard).
 */
import { Square, Trash2 } from "lucide-react";

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface RecordingPillProps {
  elapsedSeconds: number;
  /** Stop recording and submit the report. */
  onStop: () => void;
  /** Throw the in-progress recording away and return to idle. */
  onDiscard: () => void;
}

export function RecordingPill({ elapsedSeconds, onStop, onDiscard }: RecordingPillProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#14254A] py-2.5 pl-5 pr-2.5 shadow-lg">
      <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
      <span className="text-[14px] font-medium text-white">
        Grabando reporte · {formatElapsed(elapsedSeconds)}
      </span>
      <button
        type="button"
        onClick={onDiscard}
        aria-label="Descartar grabación"
        title="Descartar grabación"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <Trash2 size={14} />
      </button>
      <button
        type="button"
        onClick={onStop}
        aria-label="Detener y enviar"
        title="Detener y enviar"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DC2626] text-white transition hover:bg-[#B91C1C]"
      >
        <Square size={14} fill="currentColor" />
      </button>
    </div>
  );
}

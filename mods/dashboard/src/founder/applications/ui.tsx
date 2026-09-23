/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Small building blocks shared by the application card and side panel, styled
 * to Pencil EzobQ §08 tokens (ds.violet #7C3AED / bg #F1EAFE / tint #FAF7FF).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { scoreTone, statusMeta, type StatusTone } from "../../lib/applications";

export const VIOLET = "#7C3AED";

const STATUS_CLASSES: Record<StatusTone, string> = {
  violet: "bg-[#F1EAFE] text-[#7C3AED]",
  green: "bg-[#E8F7EE] text-[#16A34A]",
  red: "bg-[#FCEBEB] text-[#DC2626]",
  muted: "bg-[#EEF3F9] text-[#697A93]"
};

/** The single current-status label (never the full path). */
export function StatusPill({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      data-testid="status-pill"
      data-status={status}
      className={cn(
        "inline-flex shrink-0 items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11px] font-semibold",
        STATUS_CLASSES[meta.tone]
      )}
    >
      <span className="h-[6px] w-[6px] rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

const SCORE_CLASSES = {
  green: "bg-[#E8F7EE] text-[#16A34A]",
  amber: "bg-[#FDF1E3] text-[#D97706]",
  red: "bg-[#FCEBEB] text-[#DC2626]",
  muted: "bg-[#EEF3F9] text-[#697A93]"
} as const;

export function ScoreChip({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-[8px] px-2 py-[3px]",
        SCORE_CLASSES[scoreTone(score)]
      )}
    >
      <span className="text-[10px] font-semibold">MS</span>
      <span className="text-[12px] font-bold">{score}</span>
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  tone?: "primary" | "secondary" | "success";
  children: ReactNode;
};

const BTN_TONES = {
  primary: "bg-[#1F4AA8] text-white hover:bg-[#1a3f90] disabled:bg-[#1F4AA8]",
  secondary: "border border-[#E5EAF1] bg-white text-[#14254A] hover:bg-[#F4F7FB]",
  success: "bg-[#16A34A] text-white hover:bg-[#12883d] disabled:bg-[#16A34A]"
} as const;

export function Btn({ icon: Icon, tone = "secondary", className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex items-center gap-[7px] rounded-[9px] px-4 py-[9px] text-[14px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45",
        BTN_TONES[tone],
        className
      )}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function SectionLabel({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#697A93]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[#E5EAF1]" />
      {extra}
    </div>
  );
}

/** Label + control, the panel's form field. */
export function PanelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-[6px]">
      <span className="text-[12px] font-medium text-[#697A93]">{label}</span>
      {children}
    </label>
  );
}

export const INPUT_CLASS =
  "w-full rounded-[8px] border border-[#E5EAF1] bg-white px-3 py-[9px] text-[13px] font-medium text-[#14254A] outline-none focus:border-[#7C3AED]";

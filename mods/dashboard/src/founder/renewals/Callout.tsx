/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReactNode } from "react";
import { CircleAlert, Info, Lock, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

const TONES = {
  info: { box: "bg-brand-mist", fg: "text-brand-blue-primary", Icon: Info },
  warn: { box: "bg-ds-amber-bg", fg: "text-ds-amber", Icon: TriangleAlert },
  error: { box: "bg-ds-red-bg", fg: "text-ds-red", Icon: CircleAlert },
  note: { box: "bg-ds-subtle", fg: "text-brand-ink", Icon: Lock }
} satisfies Record<string, { box: string; fg: string; Icon: LucideIcon }>;

export function Callout({
  tone,
  title,
  children,
  testId
}: {
  tone: keyof typeof TONES;
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      data-testid={testId}
      className={cn("flex gap-[10px] rounded-[10px] px-[14px] py-[12px]", t.box)}
    >
      <t.Icon size={16} className={cn("mt-[1px] shrink-0", t.fg)} />
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className={cn("text-[13px] font-semibold", t.fg)}>{title}</span>
        <span className="text-[12px] font-medium leading-[1.4] text-brand-ink">{children}</span>
      </div>
    </div>
  );
}

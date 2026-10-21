/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { cn } from "../../lib/cn";
import { renewalStatusLabel, renewalTone } from "./status";

export function RenewalStatusPill({ status }: { status: string }) {
  const tone = renewalTone(status);
  return (
    <span
      data-testid="renewal-status"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11px] font-semibold",
        tone.pill
      )}
    >
      <span className={cn("h-[6px] w-[6px] rounded-full", tone.dot)} />
      {renewalStatusLabel(status)}
    </span>
  );
}

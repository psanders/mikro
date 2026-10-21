/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * "Lo que se va a registrar": the new loan, minus what is still owed on the old
 * one, equals what leaves the account (Pencil EzobQ sec-12 C).
 */
import { formatDop } from "../../lib/applications";

export function RenewalSummary({
  principal,
  owed,
  net,
  previousNet,
  done
}: {
  principal: number;
  owed: number | undefined;
  net: number | undefined;
  /** The net the user saw before it changed, struck through. */
  previousNet?: number;
  done?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-[10px] rounded-[12px] bg-ds-subtle p-[16px]"
      data-testid="renewal-summary"
    >
      <div className="flex items-center justify-between text-[13px] font-medium text-ds-muted">
        <span>Préstamo nuevo</span>
        <span className="font-semibold text-brand-ink">{formatDop(principal)}</span>
      </div>
      <div className="flex items-center justify-between text-[13px] font-medium text-ds-muted">
        <span>Debe hoy (préstamo anterior)</span>
        <span data-testid="renewal-owed" className="font-semibold text-brand-ink">
          {owed != null ? formatDop(owed) : "…"}
        </span>
      </div>
      <div className="h-px bg-ds-border" />
      <div className="flex items-center justify-between text-[13px] font-semibold text-brand-ink">
        <span>{done ? "Desembolsado" : "A desembolsar (sale de la cuenta)"}</span>
        <span className="flex items-baseline gap-2">
          {previousNet != null && net != null && previousNet !== net && (
            <span className="text-[12px] font-medium text-ds-muted line-through">
              {formatDop(previousNet)}
            </span>
          )}
          <span data-testid="renewal-net" className="text-[18px] font-bold text-ds-green">
            {net != null ? formatDop(net) : "…"}
          </span>
        </span>
      </div>
    </div>
  );
}

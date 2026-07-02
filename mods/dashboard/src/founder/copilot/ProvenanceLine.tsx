/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The source line under an assistant reply — Pencil `src`: a small wrench glyph
 * plus "Mikro API · <tools> · <elapsed>". Elapsed renders as seconds (e.g.
 * "1.2 s") to match the export (feed-dock-open.html: "analizar_mora · 1.2 s").
 */
import { Wrench } from "lucide-react";
import { cn } from "../../lib/cn";
import type { CopilotProvenance } from "./types";

export interface ProvenanceLineProps {
  provenance: CopilotProvenance;
  className?: string;
}

function formatElapsed(elapsedMs: number): string {
  return `${(elapsedMs / 1000).toFixed(1)} s`;
}

export function ProvenanceLine({ provenance, className }: ProvenanceLineProps) {
  const parts = ["Mikro API"];
  if (provenance.tools.length > 0) parts.push(provenance.tools.join(", "));
  parts.push(formatElapsed(provenance.elapsedMs));

  return (
    <div className={cn("flex items-center gap-[6px] text-[#697A93]", className)}>
      <Wrench size={11} strokeWidth={2} className="shrink-0" />
      <span className="text-[10px] font-medium">{parts.join(" · ")}</span>
    </div>
  );
}

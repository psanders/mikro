/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Presentational "update ready" banner for the desktop app. Shown once a newer
 * build has been downloaded + installed in the background; it tells the operator
 * the update applies on next launch and offers an immediate restart. Placement
 * mirrors the toast (bottom-center, floating). No-ops on the web build — it's
 * only rendered by {@link AppUpdater}, which is desktop-gated.
 */
import { CircleCheck, RefreshCw, X } from "lucide-react";
import { Button } from "./ui/Button";

interface UpdateBannerProps {
  /** The staged version that will apply on next launch. */
  version: string;
  /** Relaunch now to apply it. */
  onRestart: () => void;
  /** Hide the banner for this session. */
  onDismiss: () => void;
}

export function UpdateBanner({ version, onRestart, onDismiss }: UpdateBannerProps) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-[12px] border border-ds-border bg-ds-surface px-4 py-3 shadow-lg"
    >
      <CircleCheck size={18} className="shrink-0 text-ds-green" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-brand-ink">Mikro v{version} lista</p>
        <p className="text-[12px] text-ds-muted">Se aplicará la próxima vez que abras la app.</p>
      </div>
      <Button
        variant="primary"
        icon={RefreshCw}
        onClick={onRestart}
        className="shrink-0 px-3 py-2 text-[13px]"
      >
        Reiniciar ahora
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar"
        className="shrink-0 text-ds-muted transition hover:text-brand-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}

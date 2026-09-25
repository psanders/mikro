/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The founder app's only overlay (Pencil EzobQ §08 "panel lateral"): a 600px
 * panel on the right over a light scrim, so the feed stays visible behind it.
 * Every application view (detail, edit, evidence, contract, disbursement,
 * assign) and the Tareas form render in it — there are no modal dialogs.
 * Nested views pass `onBack` to show the "← Solicitud de …" crumb; actions go
 * in the pinned `footer`.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, X, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Shows the back crumb above the title. */
  onBack?: () => void;
  backLabel?: string;
  /** Right side of the header (status pill, score, …). */
  headerExtra?: ReactNode;
  /** Pinned to the bottom, above nothing — the view's actions. */
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
}

export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  onBack,
  backLabel,
  headerExtra,
  footer,
  children,
  testId = "side-panel",
  className
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" data-testid={`${testId}-root`}>
      <div
        className="absolute inset-0 bg-[#14254A33]"
        onClick={onClose}
        aria-hidden="true"
        data-testid={`${testId}-scrim`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        className={cn(
          "absolute inset-y-0 right-0 flex w-[600px] max-w-full flex-col overflow-hidden rounded-l-[16px] bg-white shadow-[-12px_0_40px_#14254A40] outline-none",
          className
        )}
      >
        <div className="shrink-0 border-b border-[#E5EAF1] px-6 pb-4 pt-5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              data-testid={`${testId}-back`}
              className="mb-3 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#1F4AA8] hover:text-[#14356e]"
            >
              <ArrowLeft size={16} />
              {backLabel ?? "Volver"}
            </button>
          )}
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F1EAFE] text-[#7C3AED]">
                <Icon size={17} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-semibold tracking-[-0.2px] text-[#14254A]">
                {title}
              </h2>
              {subtitle && (
                <p className="truncate text-[12px] font-medium text-[#697A93]">{subtitle}</p>
              )}
            </div>
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              data-testid={`${testId}-close`}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#697A93] hover:bg-[#F4F7FB]"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center gap-[10px] border-t border-[#E5EAF1] px-6 pb-5 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

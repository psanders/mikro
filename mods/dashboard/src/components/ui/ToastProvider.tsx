/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import { Toast, type ToastVariant } from "./Toast";

/**
 * Toast vs. inline boundary:
 *   - Transient ACTION/MUTATION results (send promo, promote error, delete
 *     error, payment saved, transaction saved, …) → useToast().
 *   - CONTEXTUAL messages — form-field validation errors and page-level
 *     load/empty error states — stay INLINE where they occur, not here.
 */

const AUTO_DISMISS_MS = 8000;

interface ToastState {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

/** Optional per-toast overrides (e.g. a longer window for a message the user must read, like a saved-file path). */
interface ToastOptions {
  durationMs?: number;
}

interface ToastApi {
  notify: (toast: { variant: ToastVariant; message: string; durationMs?: number }) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** App-level provider: holds the single active toast and its lifecycle. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  // Single active toast: a new one replaces the current and resets the timeout.
  const notify = useCallback<ToastApi["notify"]>(({ variant, message, durationMs }) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), variant, message, durationMs: durationMs ?? AUTO_DISMISS_MS });
  }, []);

  const success = useCallback<ToastApi["success"]>(
    (message, options) => notify({ variant: "success", message, durationMs: options?.durationMs }),
    [notify]
  );
  const error = useCallback<ToastApi["error"]>(
    (message, options) => notify({ variant: "error", message, durationMs: options?.durationMs }),
    [notify]
  );

  // Stable identity so consumers can safely list api in effect deps without
  // re-firing when the provider re-renders to show/hide a toast.
  const api = useMemo<ToastApi>(() => ({ notify, success, error }), [notify, success, error]);

  useEffect(() => {
    if (!toast) return;
    timer.current = setTimeout(() => setToast(null), toast.durationMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Toast variant={toast.variant} message={toast.message} onDismiss={dismiss} />
        </div>
      )}
    </ToastContext.Provider>
  );
}

/** Raise transient action feedback from any page or component. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

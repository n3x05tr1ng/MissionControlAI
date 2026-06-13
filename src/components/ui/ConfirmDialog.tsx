"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

// Module-level dispatcher so any caller can trigger a confirm without
// needing to render the dialog itself. ConfirmHost (mounted from layout)
// subscribes and renders the portal.
type Listener = (req: PendingConfirm) => void;
let listener: Listener | null = null;

function setListener(cb: Listener | null): void {
  listener = cb;
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!listener) {
      // No host mounted; default to "cancel" so callers don't block on a hang.
      resolve(false);
      return;
    }
    listener({ ...options, resolve });
  });
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useCallback((options) => confirm(options), []);
}

// Detección SSR-safe de cliente sin setState dentro del effect.
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    setListener((req) => setPending(req));
    return () => {
      setListener(null);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") settle(false);
      // Enter solo confirma acciones NO destructivas; las peligrosas
      // requieren un click (o tab + enter sobre el botón enfocado).
      if (e.key === "Enter" && !pending?.danger) settle(true);
    }
    function settle(value: boolean) {
      pending?.resolve(value);
      setPending(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  if (!mounted || !pending) return null;

  const {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
  } = pending;

  function settle(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  const actionClass = danger
    ? "border border-destructive/40 bg-destructive-soft text-destructive hover:bg-destructive/25"
    : "bg-primary text-primary-foreground hover:bg-primary-hover";

  return createPortal(
    <div
      className="hive-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={() => settle(false)}
    >
      <div
        className="glass animate-overlay w-full max-w-md overflow-hidden rounded-xl shadow-overlay"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
          <h2
            id="confirm-dialog-title"
            className="text-[15px] font-semibold text-foreground"
          >
            {title}
          </h2>
          {message ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
              {message}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={() => settle(false)}
            autoFocus={danger}
            className="h-8 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            autoFocus={!danger}
            className={`h-8 rounded-md px-3 text-[13px] font-medium ${actionClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

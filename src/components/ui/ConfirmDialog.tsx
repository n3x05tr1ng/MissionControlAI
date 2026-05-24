"use client";

import { useCallback, useEffect, useState } from "react";
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

export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setListener((req) => setPending(req));
    return () => {
      setListener(null);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
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
    ? "border-red-500/60 bg-red-500/10 text-red-300 hover:bg-red-500/20"
    : "border-hive-amber bg-hive-amber/10 text-hive-amber hover:bg-hive-amber/20";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 hive-modal-overlay"
      onClick={() => settle(false)}
    >
      <div
        className="w-full max-w-md border border-hive-border bg-hive-panel hive-modal-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="border-b border-hive-border px-4 py-2">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
            [ {title} ]
          </h2>
        </header>
        <div className="px-4 py-4 flex flex-col gap-4">
          {message ? (
            <p className="text-sm text-hive-text whitespace-pre-wrap">
              {message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => settle(false)}
              className="border border-hive-border px-3 py-1 text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              autoFocus
              className={`border px-3 py-1 text-xs uppercase tracking-widest ${actionClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

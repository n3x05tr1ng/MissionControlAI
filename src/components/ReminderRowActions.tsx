"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { notify } from "@/lib/ui/notify";

type Props = {
  reminderId: string;
};

export function ReminderRowActions({ reminderId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dismiss() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reminders/${encodeURIComponent(reminderId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = body.error ?? `HTTP ${res.status}`;
        setError(msg);
        notify.error(msg);
        setBusy(false);
        return;
      }
      notify.success("Reminder dismissed");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={dismiss}
        disabled={busy}
        className="inline-flex h-7 items-center rounded-md border border-border bg-transparent px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Dismissing…" : "Dismiss"}
      </button>
      {error ? (
        <span role="alert" className="font-mono text-[11px] text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}

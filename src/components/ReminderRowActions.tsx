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
        className="border border-hive-border bg-transparent px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber hover:border-hive-amber disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "…" : "dismiss"}
      </button>
      {error ? (
        <span className="font-mono text-[10px] text-red-400">{error}</span>
      ) : null}
    </span>
  );
}

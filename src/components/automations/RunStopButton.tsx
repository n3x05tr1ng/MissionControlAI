"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";

type Props = {
  runId: string;
};

export function RunStopButton({ runId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function stop() {
    const ok = await confirm({
      title: "Stop run?",
      message: "Stops the current automation run.",
      confirmLabel: "Stop",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/automation-runs/${runId}/stop`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify.success("Run stopped");
      router.refresh();
    } catch (err) {
      notify.error(`Stop failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void stop()}
      disabled={busy}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive-soft px-3 text-[13px] font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <rect
          x="2.5"
          y="2.5"
          width="7"
          height="7"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      {busy ? "Stopping…" : "Stop run"}
    </button>
  );
}

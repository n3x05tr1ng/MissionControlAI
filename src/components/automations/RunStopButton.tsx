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
      className="border border-red-400 bg-red-400/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-red-400 hover:bg-red-400/20 disabled:opacity-50"
    >
      {busy ? "stopping…" : "■ Stop"}
    </button>
  );
}

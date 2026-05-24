"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { notify } from "@/lib/ui/notify";

type Props = {
  runId: string;
};

export function HumanReviewForm({ runId }: Props) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(verdict: "approve" | "reject") {
    setBusy(true);
    try {
      const res = await fetch(`/api/automation-runs/${runId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict,
          feedback: comment.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify.success(`Decision recorded: ${verdict}`);
      setComment("");
      router.refresh();
    } catch (err) {
      notify.error(`Decision failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border border-yellow-300/40 bg-yellow-300/5 p-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-yellow-300">
        Your decision
      </span>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment / feedback…"
        rows={3}
        className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text resize-none focus:border-hive-amber focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void decide("approve")}
          disabled={busy}
          className="border border-emerald-400 bg-emerald-400/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-emerald-400 hover:bg-emerald-400/20 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => void decide("reject")}
          disabled={busy}
          className="border border-red-400 bg-red-400/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-red-400 hover:bg-red-400/20 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

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
    <div className="mt-3 flex flex-col gap-2.5 rounded-lg border border-warning/40 bg-warning-soft p-3">
      <span className="text-[12px] font-medium text-warning">
        Your decision
      </span>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment / feedback…"
        rows={3}
        className="resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void decide("approve")}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-success/40 bg-success-soft px-3 text-[13px] font-medium text-success hover:bg-success/25 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="m2.5 7.5 3 3 6-6.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Approve
        </button>
        <button
          type="button"
          onClick={() => void decide("reject")}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive-soft px-3 text-[13px] font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="m3.5 3.5 7 7m0-7-7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Reject
        </button>
      </div>
    </div>
  );
}

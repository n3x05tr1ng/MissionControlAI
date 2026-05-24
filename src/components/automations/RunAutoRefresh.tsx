"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  runId: string;
  active: boolean;
};

// Connects to the SSE stream for automation runs. When an event matches
// this runId, triggers a router.refresh() so the server component re-renders
// with the new state. Falls back to a polling interval if SSE fails.
export function RunAutoRefresh({ runId, active }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;
    let closed = false;

    function startPolling() {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        if (!closed) router.refresh();
      }, 4000);
    }

    try {
      es = new EventSource(`/api/automation-runs/stream`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { runId?: string };
          if (data && data.runId === runId) router.refresh();
        } catch {
          // ignore malformed events
        }
      };
      es.onerror = () => {
        if (closed) return;
        es?.close();
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      closed = true;
      if (es) es.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [runId, active, router]);

  return null;
}

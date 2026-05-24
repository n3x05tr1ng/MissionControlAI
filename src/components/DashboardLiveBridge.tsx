"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Subscribes to /api/projects/stream and triggers a debounced router.refresh
// when the server reports project_index, project, or membership changes.
// SSR keeps the first paint snappy; this just keeps it live.
const DEBOUNCE_MS = 500;

export function DashboardLiveBridge() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.EventSource === "undefined") return;

    const es = new EventSource("/api/projects/stream");
    let timer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
      }, DEBOUNCE_MS);
    }

    es.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data) as { type?: string };
        if (!frame || typeof frame.type !== "string") return;
        // Snapshot fires on connect — skip it; SSR already painted.
        if (frame.type === "snapshot") return;
        scheduleRefresh();
      } catch {
        // ignore
      }
    };

    return () => {
      if (timer) clearTimeout(timer);
      es.close();
    };
  }, [router]);

  return null;
}

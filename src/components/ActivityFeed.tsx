"use client";

import { useEffect, useRef, useState } from "react";

import type { AgentEvent } from "@/lib/contracts";

type Props = {
  projectId: string;
  onRunStateChange?: (running: boolean) => void;
};

const MAX_EVENTS = 500;
const TRUNCATE_AT = 140;

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function kindLabel(ev: AgentEvent): string {
  return ev.type;
}

function kindColorClass(ev: AgentEvent): string {
  switch (ev.type) {
    case "session.start":
      return "text-hive-cyan";
    case "session.end":
      return ev.result === "error" ? "text-hive-red" : "text-hive-green";
    case "message":
      return "text-hive-amber";
    case "tool.use":
      return "text-hive-yellow";
    case "tool.result":
      return "text-hive-muted";
    case "error":
      return "text-hive-red";
    case "log":
    default:
      return "text-hive-muted";
  }
}

function renderBody(ev: AgentEvent): React.ReactNode {
  switch (ev.type) {
    case "session.start":
      return (
        <span className="text-hive-muted">
          session {ev.sessionId.slice(0, 8)} started
        </span>
      );
    case "message": {
      const prefix = ev.role === "assistant" ? "> " : "";
      return (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-hive-text">
          {prefix}
          {ev.text}
        </pre>
      );
    }
    case "tool.use":
      return (
        <span className="text-hive-text/90">
          <span className="text-hive-yellow">{ev.name}</span>{" "}
          <span className="text-hive-muted">
            {truncate(safeStringify(ev.input), TRUNCATE_AT)}
          </span>
        </span>
      );
    case "tool.result":
      return (
        <span className="text-hive-muted">
          {ev.name}: {truncate(safeStringify(ev.output), TRUNCATE_AT)}
        </span>
      );
    case "session.end": {
      const okOrErr = ev.result === "error" ? "ended ERROR" : "ended OK";
      const cost = `$${ev.costUsd.toFixed(2)}`;
      const tokens = `${ev.tokens.input}/${ev.tokens.output} tokens`;
      const files = `${ev.filesTouched.length} files`;
      return (
        <span className="text-hive-text/90">
          {okOrErr} · {cost} · {tokens} · {files}
        </span>
      );
    }
    case "error":
      return <span className="text-hive-red">{ev.message}</span>;
    case "log":
      return (
        <span className="text-hive-muted">
          [{ev.level}] {ev.message}
        </span>
      );
    default:
      return null;
  }
}

export function ActivityFeed({ projectId, onRunStateChange }: Props) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const onRunStateChangeRef = useRef(onRunStateChange);

  useEffect(() => {
    onRunStateChangeRef.current = onRunStateChange;
  }, [onRunStateChange]);

  useEffect(() => {
    const es = new EventSource(`/api/projects/${projectId}/stream`);

    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as AgentEvent;
        setEvents((prev) => {
          const next = prev.length >= MAX_EVENTS ? prev.slice(-MAX_EVENTS + 1) : prev.slice();
          next.push(ev);
          return next;
        });
        if (ev.type === "session.start") {
          onRunStateChangeRef.current?.(true);
        } else if (ev.type === "session.end" || ev.type === "error") {
          onRunStateChangeRef.current?.(false);
        }
      } catch {
        // ignore malformed payloads
      }
    };

    es.onerror = () => {
      // Let the browser auto-reconnect; do not close here.
    };

    return () => {
      es.close();
    };
  }, [projectId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 8;
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className="h-[360px] overflow-y-auto border border-hive-border bg-hive-bg/40 p-3 font-mono text-xs leading-relaxed"
    >
      {events.length === 0 ? (
        <p className="text-hive-muted">Waiting for activity...</p>
      ) : (
        <ul className="space-y-1">
          {events.map((ev, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-hive-muted">{formatTime(ev.ts)}</span>
              <span className={`shrink-0 ${kindColorClass(ev)}`}>
                [{kindLabel(ev)}]
              </span>
              <span className="min-w-0 flex-1 break-words">{renderBody(ev)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

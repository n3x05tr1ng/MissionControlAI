"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// xterm.js types are loaded via dynamic import in useEffect to avoid SSR.
// We use unknown + narrow casts at the boundary to keep src/ free of `any`.

type ShellKind = "claude" | "claude-resume" | "shell";
type Status = "connecting" | "connected" | "disconnected" | "dead";

type Props = {
  projectId: string;
  shell?: ShellKind;
};

const SHELL_OPTIONS: Array<{ value: ShellKind; label: string }> = [
  { value: "claude", label: "claude" },
  { value: "claude-resume", label: "claude --resume" },
  { value: "shell", label: "shell" },
];

export function EmbeddedTerminal({ projectId, shell: initialShell }: Props) {
  const [shell, setShell] = useState<ShellKind>(initialShell ?? "claude");
  const [status, setStatus] = useState<Status>("connecting");
  const [reconnectKey, setReconnectKey] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<{ write: (d: string | Uint8Array) => void; dispose: () => void; onData: (cb: (d: string) => void) => void; cols: number; rows: number } | null>(null);
  const fitRef = useRef<{ fit: () => void } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPongRef = useRef<number>(0);
  const reconnectedOnceRef = useRef(false);

  const wsUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const host = window.location.hostname || "localhost";
    return `ws://${host}:3001/terminal?projectId=${encodeURIComponent(projectId)}&shell=${encodeURIComponent(shell)}`;
  }, [projectId, shell]);

  const reconnect = useCallback(() => {
    reconnectedOnceRef.current = false;
    setReconnectKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
      ]);
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        theme: { background: "#0b0d0f", foreground: "#e6e6e6", cursor: "#FFB000" },
        fontFamily: "var(--font-jetbrains-mono), ui-monospace, Menlo, monospace",
        fontSize: 13,
        cursorBlink: true,
        scrollback: 5000,
        convertEol: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.open(containerRef.current);
      try { fitAddon.fit(); } catch { /* noop */ }

      // Cast at boundary: xterm types are loose; we only need write/dispose/onData/cols/rows.
      termRef.current = term as unknown as typeof termRef.current;
      fitRef.current = fitAddon as unknown as typeof fitRef.current;

      socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      wsRef.current = socket;
      setStatus("connecting");

      socket.onopen = () => {
        setStatus("connected");
        lastPongRef.current = Date.now();
        try {
          socket?.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        } catch { /* noop */ }
      };

      socket.onmessage = (e: MessageEvent) => {
        const d = e.data as unknown;
        if (typeof d === "string") {
          // PTY stdout or pong frame.
          if (d.startsWith("{") && d.includes("\"pong\"")) {
            try {
              const parsed = JSON.parse(d) as { type?: string };
              if (parsed.type === "pong") {
                lastPongRef.current = Date.now();
                return;
              }
            } catch { /* fall through */ }
          }
          term.write(d);
        } else if (d instanceof ArrayBuffer) {
          term.write(new Uint8Array(d));
        }
      };

      socket.onclose = () => {
        setStatus((s) => (s === "dead" ? "dead" : "disconnected"));
      };
      socket.onerror = () => {
        setStatus("disconnected");
      };

      term.onData((d: string) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "input", data: d }));
        }
      });

      const sendResize = () => {
        try { fitAddon.fit(); } catch { /* noop */ }
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          } catch { /* noop */ }
        }
      };
      if (containerRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => sendResize());
        resizeObserver.observe(containerRef.current);
      }
      window.addEventListener("resize", sendResize);

      pingTimerRef.current = setInterval(() => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        try { socket.send(JSON.stringify({ type: "ping" })); } catch { /* noop */ }
        if (Date.now() - lastPongRef.current > 40_000) {
          if (!reconnectedOnceRef.current) {
            reconnectedOnceRef.current = true;
            try { socket.close(); } catch { /* noop */ }
            setStatus("disconnected");
            setReconnectKey((k) => k + 1);
          } else {
            setStatus("dead");
          }
        }
      }, 20_000);

      // Cleanup binding: closure captures sendResize.
      const cleanupWindow = () => window.removeEventListener("resize", sendResize);
      // Stash on socket so cleanup can find it.
      (socket as unknown as { _cleanupWindow?: () => void })._cleanupWindow = cleanupWindow;
    })().catch((err) => {
      console.error("[term] init failed", err);
      setStatus("dead");
    });

    return () => {
      disposed = true;
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
      if (resizeObserver) resizeObserver.disconnect();
      const s = wsRef.current;
      if (s) {
        const w = (s as unknown as { _cleanupWindow?: () => void })._cleanupWindow;
        if (w) w();
        try { s.close(); } catch { /* noop */ }
      }
      wsRef.current = null;
      const t = termRef.current;
      if (t) {
        try { t.dispose(); } catch { /* noop */ }
      }
      termRef.current = null;
      fitRef.current = null;
    };
  }, [wsUrl, reconnectKey]);

  const dotClass =
    status === "connected"
      ? "bg-hive-green"
      : status === "dead"
        ? "bg-hive-red"
        : "bg-hive-amber";

  const dotLabel =
    status === "connected"
      ? "connected"
      : status === "dead"
        ? "dead"
        : status === "connecting"
          ? "connecting"
          : "disconnected";

  return (
    <section className="border border-hive-border bg-hive-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hive-border px-3 py-2">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
            [ TERMINAL — live ]
          </h2>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-hive-muted">
            <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
            {dotLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {SHELL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (opt.value !== shell) setShell(opt.value);
              }}
              className={`font-mono text-[11px] px-2 py-1 border ${
                shell === opt.value
                  ? "border-hive-amber text-hive-amber"
                  : "border-hive-border text-hive-muted hover:text-hive-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={reconnect}
            className="ml-2 font-mono text-[11px] px-2 py-1 border border-hive-border text-hive-muted hover:text-hive-amber hover:border-hive-amber"
          >
            reconnect
          </button>
        </div>
      </header>
      <div
        ref={containerRef}
        className="bg-hive-bg p-2 h-[320px] sm:h-[480px] w-full overflow-hidden"
      />
    </section>
  );
}

export default EmbeddedTerminal;

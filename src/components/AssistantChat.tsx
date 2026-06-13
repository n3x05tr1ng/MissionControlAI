"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { HexIcon } from "@/components/icons/HexIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { notify } from "@/lib/ui/notify";

type TextBlock = { type: "text"; text: string };
type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};
type ToolResultBlock = {
  type: "tool_result";
  id: string;
  name: string;
  output: unknown;
};
type Block = TextBlock | ToolUseBlock | ToolResultBlock;

type Role = "user" | "assistant" | "tool";

type Message = {
  id: string;
  role: Role;
  blocks: Block[];
  createdAt?: string;
  inProgress?: boolean;
};

type ErrorState =
  | { kind: "none" }
  | { kind: "missingKey" }
  | { kind: "generic"; message: string };

/** Shape devuelto por GET /api/assistant/[conversationId]. */
type HistoryMessage = {
  role?: string;
  blocks?: unknown[];
  createdAt?: string;
};

const STORAGE_KEY = "hive:assistant:conversation-id";

const PLACEHOLDER =
  "Ask anything — e.g. \"what should I work on next?\" or \"remind me to revisit X tomorrow\"";

const SUGGESTIONS = [
  "What should I work on next?",
  "What's blocked right now?",
  "Remind me to review the board tomorrow",
];

function safePreview(value: unknown, max = 120): string {
  let s: string;
  if (typeof value === "string") {
    s = value;
  } else {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  }
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function summarizeOutput(output: unknown): string {
  if (output && typeof output === "object" && "error" in output) {
    const err = (output as { error?: unknown }).error;
    return `error: ${safePreview(err)}`;
  }
  if (Array.isArray(output)) {
    return `${output.length} item${output.length === 1 ? "" : "s"}`;
  }
  if (output && typeof output === "object") {
    const keys = Object.keys(output as object);
    return `{ ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", …" : ""} }`;
  }
  return safePreview(output);
}

function newId(): string {
  return crypto.randomUUID();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readStoredConversationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeConversationId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage unavailable — the conversation just won't resume next visit
  }
}

/**
 * Aplana un mensaje del historial al formato de la UI: los runs de texto se
 * agrupan en un mensaje del rol original y cada bloque tool_use/tool_result
 * se separa como mensaje "tool" (mismo orden que produce el streaming en vivo).
 */
function splitHistoryMessage(msg: HistoryMessage): Message[] {
  const role: Role =
    msg.role === "user" || msg.role === "tool" ? msg.role : "assistant";
  const createdAt = typeof msg.createdAt === "string" ? msg.createdAt : undefined;
  const out: Message[] = [];
  let textRun: Block[] = [];

  const flushText = () => {
    if (textRun.length === 0) return;
    out.push({ id: newId(), role, blocks: textRun, createdAt });
    textRun = [];
  };

  if (!Array.isArray(msg.blocks)) return out;
  for (const raw of msg.blocks) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string") {
      if (block.text.length > 0) {
        textRun.push({ type: "text", text: block.text });
      }
      continue;
    }
    if (block.type === "tool_use" || block.type === "tool_result") {
      flushText();
      out.push({
        id: newId(),
        role: "tool",
        blocks: [
          block.type === "tool_use"
            ? {
                type: "tool_use",
                id: typeof block.id === "string" ? block.id : "",
                name: typeof block.name === "string" ? block.name : "",
                input: block.input,
              }
            : {
                type: "tool_result",
                id: typeof block.id === "string" ? block.id : "",
                name: typeof block.name === "string" ? block.name : "",
                output: block.output,
              },
        ],
        createdAt,
      });
    }
  }
  flushText();
  return out;
}

async function fetchHistory(
  id: string | null,
  signal: AbortSignal,
): Promise<Message[] | null> {
  if (!id) return null;
  const res = await fetch(`/api/assistant/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { messages?: HistoryMessage[] };
  if (!json || !Array.isArray(json.messages)) return null;
  return json.messages.flatMap(splitHistoryMessage);
}

/** Cierra el turno del asistente; si quedó vacío (p. ej. stop temprano), lo retira. */
function finalizeAssistant(prev: Message[], assistantId: string): Message[] {
  return prev
    .map((m) => (m.id === assistantId ? { ...m, inProgress: false } : m))
    .filter((m) => !(m.id === assistantId && m.blocks.length === 0));
}

export function AssistantChat() {
  // "boot" mientras intentamos retomar la última conversación (localStorage +
  // GET historial). El server y el primer render del cliente coinciden (boot),
  // así que no hay hydration mismatch.
  const [phase, setPhase] = useState<"boot" | "ready">("boot");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ErrorState>({ kind: "none" });

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isAtBottomRef = useRef(true);
  const sendAbortRef = useRef<AbortController | null>(null);

  // Retoma la última conversación. Todos los setState ocurren tras un await
  // (callbacks async), nunca de forma síncrona dentro del efecto.
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    async function restore() {
      const stored = readStoredConversationId();
      let history: Message[] | null = null;
      try {
        history = await fetchHistory(stored, ctrl.signal);
      } catch {
        history = null; // abort o error de red: empezamos limpio igualmente
      }
      if (cancelled) return;
      if (stored) {
        setConversationId(stored);
        if (history && history.length > 0) setMessages(history);
      }
      setPhase("ready");
    }

    void restore();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  // Aborta cualquier stream en curso al desmontar (fuga conocida del fetch).
  useEffect(() => {
    return () => {
      sendAbortRef.current?.abort();
    };
  }, []);

  // Auto-scroll si el usuario está pegado al fondo.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, phase]);

  // Textarea auto-creciente (cap 200px); ajuste de DOM, no de estado.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distance < 8;
  }

  function appendBlockToAssistant(assistantId: string, block: Block) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, blocks: mergeBlock(m.blocks, block) } : m,
      ),
    );
  }

  function mergeBlock(blocks: Block[], next: Block): Block[] {
    if (next.type === "text") {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "text") {
        return [
          ...blocks.slice(0, -1),
          { type: "text", text: last.text + next.text },
        ];
      }
    }
    return [...blocks, next];
  }

  async function handleSend() {
    if (sending || phase !== "ready") return;
    const trimmed = input.trim();
    if (!trimmed) return;

    // La conversación nace (o continúa) aquí; persistimos el id para poder
    // retomarla en la próxima visita.
    const cid = conversationId ?? newId();
    if (cid !== conversationId) setConversationId(cid);
    storeConversationId(cid);

    setError({ kind: "none" });
    setSending(true);
    setInput("");
    isAtBottomRef.current = true;

    const controller = new AbortController();
    sendAbortRef.current = controller;

    const now = new Date().toISOString();
    const userMsg: Message = {
      id: newId(),
      role: "user",
      blocks: [{ type: "text", text: trimmed }],
      createdAt: now,
    };
    const assistantId = newId();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      blocks: [],
      createdAt: now,
      inProgress: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: cid, message: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        if (res.status === 400) {
          let msg = "Bad request";
          try {
            const j = (await res.json()) as { error?: string };
            if (j?.error) msg = j.error;
          } catch {
            // ignore
          }
          if (msg.includes("ANTHROPIC_API_KEY")) {
            setError({ kind: "missingKey" });
          } else {
            setError({ kind: "generic", message: msg });
          }
        } else {
          setError({
            kind: "generic",
            message: `Request failed (${res.status})`,
          });
        }
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx = buffer.indexOf("\n\n");
        while (idx !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf("\n\n");

          const dataLines = rawEvent
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trimStart());
          if (dataLines.length === 0) continue;
          const payloadStr = dataLines.join("\n");
          let payload: unknown;
          try {
            payload = JSON.parse(payloadStr);
          } catch {
            continue;
          }
          handleStreamEvent(payload, assistantId);
        }
      }

      setMessages((prev) => finalizeAssistant(prev, assistantId));
    } catch (err) {
      const aborted =
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError");
      if (!aborted) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError({ kind: "generic", message: msg });
        notify.error(msg);
      }
      setMessages((prev) => finalizeAssistant(prev, assistantId));
    } finally {
      setSending(false);
      if (sendAbortRef.current === controller) sendAbortRef.current = null;
    }
  }

  function handleStop() {
    sendAbortRef.current?.abort();
  }

  function handleNewChat() {
    sendAbortRef.current?.abort();
    const id = newId();
    setConversationId(id);
    storeConversationId(id);
    setMessages([]);
    setError({ kind: "none" });
    setInput("");
    textareaRef.current?.focus();
  }

  function handleSuggestion(text: string) {
    setInput(text);
    textareaRef.current?.focus();
  }

  function handleStreamEvent(payload: unknown, assistantId: string) {
    if (!payload || typeof payload !== "object") return;
    const ev = payload as Record<string, unknown>;
    const kind = ev.kind;

    if (kind === "text" && typeof ev.text === "string") {
      appendBlockToAssistant(assistantId, { type: "text", text: ev.text });
      return;
    }

    if (kind === "tool_use") {
      const toolMsg: Message = {
        id: newId(),
        role: "tool",
        blocks: [
          {
            type: "tool_use",
            id: typeof ev.id === "string" ? ev.id : "",
            name: typeof ev.name === "string" ? ev.name : "?",
            input: ev.input,
          },
        ],
      };
      setMessages((prev) => insertBeforeAssistant(prev, assistantId, toolMsg));
      return;
    }

    if (kind === "tool_result") {
      const toolMsg: Message = {
        id: newId(),
        role: "tool",
        blocks: [
          {
            type: "tool_result",
            id: typeof ev.id === "string" ? ev.id : "",
            name: typeof ev.name === "string" ? ev.name : "?",
            output: ev.output,
          },
        ],
      };
      setMessages((prev) => insertBeforeAssistant(prev, assistantId, toolMsg));
      return;
    }

    if (kind === "error" && typeof ev.message === "string") {
      setError({ kind: "generic", message: ev.message });
    }
  }

  function insertBeforeAssistant(
    prev: Message[],
    assistantId: string,
    toolMsg: Message,
  ): Message[] {
    const idx = prev.findIndex((m) => m.id === assistantId);
    if (idx < 0) return [...prev, toolMsg];
    return [...prev.slice(0, idx), toolMsg, ...prev.slice(idx)];
  }

  const canSend = phase === "ready" && !sending && input.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length > 0 && phase === "ready" ? (
        <div className="mb-2 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            <PlusIcon />
            New chat
          </button>
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Conversation"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {phase === "boot" ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <EmptyChat onSuggestion={handleSuggestion} />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-5 px-1 py-4">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 pt-4">
        <div className="mx-auto w-full max-w-3xl">
          {error.kind === "missingKey" ? (
            <div className="animate-enter mb-3 rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">
              Anthropic API key is not configured.{" "}
              <Link
                href="/settings"
                className="font-medium underline underline-offset-2 hover:text-foreground"
              >
                Open Settings
              </Link>
            </div>
          ) : null}

          {error.kind === "generic" ? (
            <div className="animate-enter mb-3 rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">
              {error.message}
            </div>
          ) : null}

          <div className="ai-border rounded-lg bg-surface-1 shadow-bevel focus-within:ring-2 focus-within:ring-ring">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={PLACEHOLDER}
              rows={1}
              autoFocus
              aria-label="Message the Assistant"
              className="block max-h-[200px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-faint"
            />
            <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1">
              <p className="hidden text-[11px] text-faint sm:block">
                <kbd className="keycap">Enter</kbd> to send ·{" "}
                <kbd className="keycap">Shift</kbd> +{" "}
                <kbd className="keycap">Enter</kbd> for a new line
              </p>
              {sending ? (
                <button
                  type="button"
                  onClick={handleStop}
                  aria-label="Stop generating"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="block size-2.5 rounded-[2px] bg-current"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!canSend}
                  aria-label="Send message"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
                >
                  <ArrowUpIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ subcomponents ----------------------------- */

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
    </svg>
  );
}

function AssistantOrb({ pulsing }: { pulsing: boolean }) {
  return (
    <div
      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary-soft text-primary ${
        pulsing ? "ai-pulse" : ""
      }`}
      aria-hidden="true"
    >
      <HexIcon size={14} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="Assistant is thinking"
      className="flex h-6 items-center gap-1.5"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground animate-[blink_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-3xl space-y-6 px-1 py-4"
    >
      <div className="flex justify-end">
        <Skeleton className="h-9 w-2/5 rounded-2xl" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="size-7 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-1/3 rounded-2xl" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="size-7 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

function EmptyChat({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="stagger-children mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-5">
        <div
          aria-hidden="true"
          className="absolute -inset-10 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, var(--primary-soft), transparent)",
            filter: "blur(28px)",
          }}
        />
        <div className="relative flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary-soft text-primary">
          <HexIcon size={26} />
        </div>
      </div>
      <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground">
        Ask anything about your portfolio
      </h2>
      <p className="mt-1.5 max-w-[44ch] text-[13px] leading-relaxed text-muted-foreground">
        The Assistant can list projects, read state, create reminders, and
        trigger runs.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="inline-flex h-8 items-center rounded-full border border-border bg-surface-1 px-3.5 text-[13px] text-muted-foreground hover:border-border-strong hover:bg-surface-2 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- markdown -------------------------------- */

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 leading-[1.65] last:mb-0">{children}</p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-[1.6]">{children}</li>,
  code: ({ className, children }) => (
    <code
      className={`rounded-xs border border-border bg-surface-2 px-1 py-px font-mono text-[0.85em] ${className ?? ""}`}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-border bg-surface-1 p-3 font-mono text-[12.5px] leading-relaxed shadow-bevel last:mb-0 [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-primary/50 pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 text-[17px] font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="mb-2 mt-4 text-[16px] font-semibold text-foreground first:mt-0">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="mb-2 mt-3 text-[15px] font-semibold text-foreground first:mt-0">
      {children}
    </h5>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto rounded-md border border-border last:mb-0">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 text-left font-medium text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-2.5 py-1.5 align-top">{children}</td>,
  hr: () => <hr className="my-4 border-border" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};

function AssistantMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
}

/* -------------------------------- messages -------------------------------- */

function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    const text = message.blocks
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return (
      <div className="animate-enter flex flex-col items-end">
        <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl border border-border bg-surface-2 px-4 py-2.5 text-[14px] leading-relaxed text-foreground shadow-bevel">
          {text}
        </div>
        {message.createdAt ? (
          <time className="mt-1 pr-1 font-mono text-[10px] text-faint">
            {formatTime(message.createdAt)}
          </time>
        ) : null}
      </div>
    );
  }

  if (message.role === "tool") {
    const block = message.blocks[0];
    if (!block) return null;
    if (block.type === "tool_use") {
      return (
        <div className="animate-enter flex min-w-0 items-baseline gap-2 pl-10 font-mono text-[11px] text-muted-foreground">
          <span className="shrink-0 text-warning">
            → {block.name || "tool"}
          </span>
          <span className="truncate text-faint">
            {safePreview(block.input)}
          </span>
        </div>
      );
    }
    if (block.type === "tool_result") {
      return (
        <details className="animate-enter min-w-0 pl-10 font-mono text-[11px] text-muted-foreground">
          <summary className="flex cursor-pointer list-none items-baseline gap-2 rounded-sm [&::-webkit-details-marker]:hidden">
            <span className="shrink-0 text-info">
              ← {block.name || "result"}
            </span>
            <span className="truncate text-faint">
              {summarizeOutput(block.output)}
            </span>
          </summary>
          <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-1 p-2.5 text-[10.5px] leading-relaxed">
            {safePreview(block.output, 2000)}
          </pre>
        </details>
      );
    }
    return null;
  }

  // Assistant: sin burbuja — texto sobre el canvas con orbe ámbar.
  const textBlocks = message.blocks.filter(
    (b): b is TextBlock => b.type === "text",
  );
  const isStreaming = Boolean(message.inProgress);
  const isThinking = isStreaming && textBlocks.length === 0;

  return (
    <div className="animate-enter flex gap-3">
      <AssistantOrb pulsing={isStreaming} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">
            Assistant
          </span>
          {message.createdAt ? (
            <time className="font-mono text-[10px] text-faint">
              {formatTime(message.createdAt)}
            </time>
          ) : null}
        </div>
        {isThinking ? (
          <TypingIndicator />
        ) : (
          <div
            className={`text-[15px] text-foreground ${
              isStreaming ? "streaming-caret" : ""
            }`}
          >
            {textBlocks.map((b, i) => (
              <AssistantMarkdown key={i} text={b.text} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
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
  inProgress?: boolean;
};

type ErrorState =
  | { kind: "none" }
  | { kind: "missingKey" }
  | { kind: "generic"; message: string };

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

export function AssistantChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ErrorState>({ kind: "none" });

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    setConversationId(newId());
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const placeholder = useMemo(
    () =>
      "Ask the Assistant — e.g. 'what should I work on next?' or 'remind me to revisit X tomorrow'",
    [],
  );

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distance < 8;
  }

  function appendBlockToAssistant(
    setter: React.Dispatch<React.SetStateAction<Message[]>>,
    assistantId: string,
    block: Block,
  ) {
    setter((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, blocks: mergeBlock(m.blocks, block) }
          : m,
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
    if (sending) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!conversationId) return;

    setError({ kind: "none" });
    setSending(true);
    setInput("");
    isAtBottomRef.current = true;

    const userMsg: Message = {
      id: newId(),
      role: "user",
      blocks: [{ type: "text", text: trimmed }],
    };
    const assistantId = newId();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      blocks: [],
      inProgress: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed }),
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

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, inProgress: false } : m,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError({ kind: "generic", message: msg });
      notify.error(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, inProgress: false } : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  function handleStreamEvent(payload: unknown, assistantId: string) {
    if (!payload || typeof payload !== "object") return;
    const ev = payload as Record<string, unknown>;
    const kind = ev.kind;

    if (kind === "text" && typeof ev.text === "string") {
      appendBlockToAssistant(setMessages, assistantId, {
        type: "text",
        text: ev.text,
      });
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

  return (
    <div className="flex flex-col gap-3">
      {error.kind === "missingKey" ? (
        <div className="border border-hive-red/60 bg-hive-red/10 px-3 py-2 font-mono text-xs text-hive-red">
          <Link href="/settings" className="underline hover:text-hive-amber">
            Configure your Anthropic API key first
          </Link>
        </div>
      ) : null}

      {error.kind === "generic" ? (
        <div className="border border-hive-red/60 bg-hive-red/10 px-3 py-2 font-mono text-xs text-hive-red">
          {error.message}
        </div>
      ) : null}

      <section className="border border-hive-border bg-hive-panel">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="h-[520px] overflow-y-auto p-4 space-y-3"
        >
          {messages.length === 0 ? (
            <EmptyState
              title="Ask anything about your portfolio"
              description="The Assistant can list projects, read state, create reminders, and trigger runs. Try: 'What's blocked?'"
            />
          ) : (
            messages.map((m) => <MessageRow key={m.id} message={m} />)
          )}
        </div>

        <div className="border-t border-hive-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={placeholder}
              rows={3}
              disabled={sending}
              className="flex-1 resize-none border border-hive-border bg-hive-bg/40 px-3 py-2 text-sm text-hive-text placeholder:text-hive-muted focus:outline-none focus:border-hive-amber"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || !input.trim()}
              className="font-mono text-xs uppercase tracking-widest border border-hive-amber px-4 py-2 text-hive-amber hover:bg-hive-amber/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {sending ? "…" : "SEND"}
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] text-hive-muted">
            cmd/ctrl + enter to send
          </p>
        </div>
      </section>
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] border border-hive-border bg-hive-bg/60 px-3 py-2 text-sm text-hive-text whitespace-pre-wrap">
          {message.blocks
            .filter((b): b is TextBlock => b.type === "text")
            .map((b, i) => (
              <p key={i}>{b.text}</p>
            ))}
        </div>
      </div>
    );
  }

  if (message.role === "tool") {
    const block = message.blocks[0];
    if (!block) return null;
    if (block.type === "tool_use") {
      return (
        <div className="flex justify-start">
          <div className="font-mono text-[11px] text-hive-muted">
            <span className="text-hive-yellow">→ {block.name}</span>{" "}
            <span>({safePreview(block.input)})</span>
          </div>
        </div>
      );
    }
    if (block.type === "tool_result") {
      return (
        <details className="font-mono text-[11px] text-hive-muted">
          <summary className="cursor-pointer">
            <span className="text-hive-cyan">← {block.name}</span>{" "}
            <span>{summarizeOutput(block.output)}</span>
          </summary>
          <pre className="mt-1 whitespace-pre-wrap break-words border border-hive-border bg-hive-bg/40 p-2 text-[10px]">
            {safePreview(block.output, 2000)}
          </pre>
        </details>
      );
    }
    return null;
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-1 text-sm text-hive-text">
        {message.blocks
          .filter((b): b is TextBlock => b.type === "text")
          .map((b, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {b.text}
            </p>
          ))}
        {message.inProgress && message.blocks.length === 0 ? (
          <p className="font-mono text-[11px] text-hive-muted">thinking…</p>
        ) : null}
      </div>
    </div>
  );
}

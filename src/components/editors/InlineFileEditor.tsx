"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { notify } from "@/lib/ui/notify";

type Kind = "state" | "handoff";

type Props = {
  projectId: string;
  kind: Kind;
  triggerLabel?: string;
  initialContent?: string;
};

const META: Record<
  Kind,
  { title: string; endpoint: (id: string) => string; bodyKey: "json" | "markdown" }
> = {
  state: {
    title: "EDIT STATE.JSON",
    endpoint: (id) => `/api/state/${id}`,
    bodyKey: "json",
  },
  handoff: {
    title: "EDIT HANDOFF.MD",
    endpoint: (id) => `/api/handoff/${id}`,
    bodyKey: "markdown",
  },
};

export function InlineFileEditor({
  projectId,
  kind,
  triggerLabel = "Edit",
  initialContent,
}: Props) {
  const router = useRouter();
  const meta = META[kind];

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<string>(initialContent ?? "");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineGutterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(meta.endpoint(projectId), { cache: "no-store" });
      const data = (await res.json()) as { content?: string | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setContent(data.content ?? "");
      setJsonError(null);
    } catch (err) {
      notify.error((err as Error).message);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [meta, projectId]);

  const onOpen = useCallback(() => {
    setOpen(true);
    void load();
  }, [load]);

  const onClose = useCallback(() => {
    setOpen(false);
    setJsonError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const validateJsonOnBlur = useCallback(() => {
    if (kind !== "state") return;
    if (content.trim().length === 0) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(content);
      setJsonError(null);
    } catch (err) {
      setJsonError((err as Error).message);
    }
  }, [content, kind]);

  const onTextareaKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const next = `${content.slice(0, start)}  ${content.slice(end)}`;
        setContent(next);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [content],
  );

  const lineCount = useMemo(
    () => Math.max(1, content.split("\n").length),
    [content],
  );

  const onSave = useCallback(async () => {
    if (kind === "state" && content.trim().length > 0) {
      try {
        JSON.parse(content);
      } catch (err) {
        setJsonError((err as Error).message);
        notify.error("Invalid JSON — fix before saving");
        return;
      }
    }
    setSaving(true);
    try {
      const body =
        kind === "state" ? { json: content } : { markdown: content };
      const res = await fetch(meta.endpoint(projectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      notify.success(kind === "state" ? "state.json saved" : "handoff.md saved");
      setOpen(false);
      router.refresh();
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [content, kind, meta, projectId, router]);

  const onScrollSync = useCallback(() => {
    const ta = textareaRef.current;
    const gutter = lineGutterRef.current;
    if (ta && gutter) gutter.scrollTop = ta.scrollTop;
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber"
      >
        {triggerLabel}
      </button>
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
              onClick={onClose}
            >
              <div
                className="w-full max-w-4xl border border-hive-border bg-hive-panel"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <header className="border-b border-hive-border px-4 py-2">
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
                    [ {meta.title} ]
                  </h2>
                </header>
                <div className="p-4">
                  {loading ? (
                    <p className="font-mono text-xs text-hive-muted">loading…</p>
                  ) : (
                    <div className="flex border border-hive-border bg-black/40">
                      <div
                        ref={lineGutterRef}
                        className="select-none overflow-hidden border-r border-hive-border bg-black/30 px-2 py-2 font-mono text-[11px] leading-[1.5rem] text-hive-muted text-right"
                        style={{ minWidth: 36 }}
                      >
                        {Array.from({ length: lineCount }, (_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>
                      <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={onTextareaKeyDown}
                        onBlur={validateJsonOnBlur}
                        onScroll={onScrollSync}
                        rows={28}
                        spellCheck={false}
                        className="flex-1 resize-y bg-transparent px-2 py-2 font-mono text-[11px] leading-[1.5rem] text-hive-text outline-none"
                      />
                    </div>
                  )}
                  {jsonError ? (
                    <p className="mt-2 font-mono text-[11px] text-red-400">
                      JSON error: {jsonError}
                    </p>
                  ) : null}
                </div>
                <footer className="flex items-center justify-end gap-2 border-t border-hive-border px-4 py-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="border border-hive-border px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-text"
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSave()}
                    disabled={saving || loading}
                    className="border border-hive-amber bg-hive-amber/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:opacity-50"
                  >
                    {saving ? "saving…" : "save"}
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

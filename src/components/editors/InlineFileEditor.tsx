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

import { Skeleton } from "@/components/ui/Skeleton";
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
  { file: string; endpoint: (id: string) => string; bodyKey: "json" | "markdown" }
> = {
  state: {
    file: "state.json",
    endpoint: (id) => `/api/state/${id}`,
    bodyKey: "json",
  },
  handoff: {
    file: "handoff.md",
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
  const titleId = `file-editor-title-${kind}`;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<string>(initialContent ?? "");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineGutterRef = useRef<HTMLDivElement | null>(null);

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
      notify.success(`${meta.file} saved`);
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
        className="inline-flex h-7 items-center rounded-md border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
      >
        {triggerLabel}
      </button>
      {open
        ? createPortal(
            <div
              className="hive-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
              onClick={onClose}
            >
              <div
                className="hive-modal-panel glass w-full max-w-4xl rounded-xl shadow-overlay"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <header className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 id={titleId} className="text-[13px] font-medium text-foreground">
                    Edit{" "}
                    <code className="font-mono text-primary">{meta.file}</code>
                  </h2>
                  <span className="hidden items-center gap-1 text-[11px] text-faint sm:inline-flex">
                    <kbd className="keycap">esc</kbd>
                    <span className="ml-1">to close</span>
                  </span>
                </header>
                <div className="p-4">
                  {loading ? (
                    <div className="flex flex-col gap-2" aria-label="Loading file">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-3/5" />
                    </div>
                  ) : (
                    <div className="flex overflow-hidden rounded-md border border-input bg-background/70">
                      <div
                        ref={lineGutterRef}
                        aria-hidden="true"
                        className="select-none overflow-hidden border-r border-border bg-surface-1 px-2 py-2 text-right font-mono text-[11px] leading-[1.5rem] text-faint"
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
                        aria-label={`${meta.file} content`}
                        className="flex-1 resize-y bg-transparent px-3 py-2 font-mono text-[12px] leading-[1.5rem] text-foreground outline-none"
                      />
                    </div>
                  )}
                  {jsonError ? (
                    <p role="alert" className="mt-2 text-[12px] text-destructive">
                      JSON error: {jsonError}
                    </p>
                  ) : null}
                </div>
                <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSave()}
                    disabled={saving || loading}
                    className="inline-flex h-8 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
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

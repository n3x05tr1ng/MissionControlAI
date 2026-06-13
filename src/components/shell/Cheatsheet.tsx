"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type Shortcut = {
  keys: string[];
  description: string;
};

type Section = {
  title: string;
  items: Shortcut[];
};

const SECTIONS: Section[] = [
  {
    title: "Global",
    items: [
      { keys: ["Cmd", "K"], description: "Open command palette" },
      { keys: ["?"], description: "Open this cheatsheet" },
      { keys: ["Esc"], description: "Close any modal, dialog or palette" },
    ],
  },
  {
    title: "Board",
    items: [
      {
        keys: ["drag"],
        description: "Move a card between columns to change status",
      },
      {
        keys: ["click card"],
        description: "Open the task editor",
      },
    ],
  },
  {
    title: "Wizard & modals",
    items: [
      { keys: ["Esc"], description: "Cancel / close" },
      {
        keys: ["Enter"],
        description: "Confirm dialogs (submit on simple forms)",
      },
    ],
  },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

// Detección SSR-safe de "ya estamos en el cliente" sin setState en effect.
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function Cheatsheet() {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "?" && !open) {
        if (isTypingTarget(e.target)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={() => setOpen(true)}
        className="fixed bottom-10 right-3 z-40 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-1 font-mono text-[13px] text-muted-foreground hover:bg-surface-2 hover:text-primary"
      >
        ?
      </button>

      {open
        ? createPortal(
            <div
              className="hive-modal-overlay fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            >
              <div
                className="glass animate-overlay w-full max-w-lg overflow-hidden rounded-xl shadow-overlay"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cheatsheet-title"
              >
                <header className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2
                    id="cheatsheet-title"
                    className="text-sm font-medium text-foreground"
                  >
                    Keyboard shortcuts
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="keycap hover:text-foreground"
                  >
                    esc
                  </button>
                </header>
                <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-4 py-4">
                  {SECTIONS.map((section) => (
                    <section key={section.title} className="flex flex-col gap-2">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
                        {section.title}
                      </h3>
                      <ul className="flex flex-col gap-1.5">
                        {section.items.map((item, idx) => (
                          <li
                            key={`${section.title}-${idx}`}
                            className="flex items-center justify-between gap-3 text-[13px]"
                          >
                            <span className="text-foreground/90">
                              {item.description}
                            </span>
                            <span className="flex items-center gap-1">
                              {item.keys.map((k, kIdx) => (
                                <kbd
                                  key={`${item.description}-${kIdx}`}
                                  className="keycap"
                                >
                                  {k}
                                </kbd>
                              ))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  <p className="border-t border-border pt-3 font-mono text-[11px] text-faint">
                    Only the wired shortcuts are listed. More coming in v0.4.
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

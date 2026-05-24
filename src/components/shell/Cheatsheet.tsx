"use client";

import { useEffect, useState } from "react";
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

export function Cheatsheet() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        className="fixed bottom-9 right-3 z-40 flex h-7 w-7 items-center justify-center border border-hive-border bg-hive-panel font-mono text-sm text-hive-amber hover:border-hive-amber hover:bg-hive-amber/10 transition-colors duration-150 ease-out shadow-lg"
      >
        ?
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 hive-modal-overlay"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-lg border border-hive-border bg-hive-panel hive-modal-panel"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cheatsheet-title"
              >
                <header className="flex items-center justify-between border-b border-hive-border px-4 py-2">
                  <h2
                    id="cheatsheet-title"
                    className="font-mono text-[10px] uppercase tracking-widest text-hive-amber"
                  >
                    [ KEYBOARD SHORTCUTS ]
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="font-mono text-xs text-hive-muted hover:text-hive-amber transition-colors duration-150 ease-out"
                  >
                    [ ESC ]
                  </button>
                </header>
                <div className="px-4 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                  {SECTIONS.map((section) => (
                    <section key={section.title} className="flex flex-col gap-2">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                        {section.title}
                      </h3>
                      <ul className="flex flex-col gap-1.5">
                        {section.items.map((item, idx) => (
                          <li
                            key={`${section.title}-${idx}`}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-hive-text/90">
                              {item.description}
                            </span>
                            <span className="flex items-center gap-1">
                              {item.keys.map((k, kIdx) => (
                                <kbd
                                  key={`${item.description}-${kIdx}`}
                                  className="border border-hive-amber/40 bg-hive-amber/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-amber"
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
                  <p className="pt-2 border-t border-hive-border text-[11px] text-hive-muted font-mono">
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

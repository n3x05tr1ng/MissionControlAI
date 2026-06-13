"use client";

import Link from "next/link";

import { openModal } from "@/lib/ui/modalBus";

// Dispatched to toggle the existing CommandPalette. The palette listens for
// Cmd/Ctrl+K via keydown; emulating that here is the cleanest way to open
// it from a CTA without leaking a global toggler.
function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  const ev = new KeyboardEvent("keydown", {
    key: "k",
    code: "KeyK",
    metaKey: true,
    bubbles: true,
  });
  window.dispatchEvent(ev);
}

const cardClass =
  "group flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2/70 p-4 text-left hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2";
const stepClass = "font-mono text-[11px] text-primary";
const titleClass = "text-sm font-medium text-foreground";
const hintClass = "text-[12px] leading-relaxed text-muted-foreground";

export function HeroFirstRunActions() {
  return (
    <div className="relative mt-6">
      <div className="stagger-children grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => openModal("newProject")}
          className={cardClass}
        >
          <span className={stepClass}>step 1</span>
          <span className={titleClass}>Add your first project</span>
          <span className={hintClass}>
            Point Hive at any folder on your machine.
          </span>
        </button>
        <Link href="/profiles" className={cardClass}>
          <span className={stepClass}>step 2</span>
          <span className={titleClass}>Browse agent profiles</span>
          <span className={hintClass}>
            Pick the personalities the agents will use.
          </span>
        </Link>
        <button
          type="button"
          onClick={openCommandPalette}
          className={cardClass}
        >
          <span className={`${stepClass} flex items-center gap-1.5`}>
            tip <span className="keycap">⌘K</span>
          </span>
          <span className={titleClass}>Open the command palette</span>
          <span className={hintClass}>
            Jump anywhere in Hive with one shortcut.
          </span>
        </button>
      </div>
      <div className="mt-4 text-center">
        <Link
          href="/welcome"
          className="text-[12px] text-muted-foreground hover:text-primary"
        >
          First time here? Open the guided wizard →
        </Link>
      </div>
    </div>
  );
}

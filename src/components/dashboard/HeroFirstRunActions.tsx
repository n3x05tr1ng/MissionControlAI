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
  "flex flex-col gap-2 border border-hive-border bg-hive-bg p-4 text-left transition-colors hover:border-hive-amber/60";
const cardTitle = "font-sans text-sm text-hive-text";
const cardHint =
  "font-mono text-[10px] uppercase tracking-widest text-hive-muted";

export function HeroFirstRunActions() {
  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => openModal("newProject")}
          className={cardClass}
        >
          <span className={cardHint}>step 1</span>
          <span className={cardTitle}>Add your first project</span>
          <span className="text-xs text-hive-muted">
            Point Hive at any folder on your machine.
          </span>
        </button>
        <Link href="/profiles" className={cardClass}>
          <span className={cardHint}>step 2</span>
          <span className={cardTitle}>Browse Agent Profiles</span>
          <span className="text-xs text-hive-muted">
            Pick the personalities the agents will use.
          </span>
        </Link>
        <button
          type="button"
          onClick={openCommandPalette}
          className={cardClass}
        >
          <span className={cardHint}>tip · cmd+k</span>
          <span className={cardTitle}>Open the command palette</span>
          <span className="text-xs text-hive-muted">
            Jump anywhere in Hive with one shortcut.
          </span>
        </button>
      </div>
      <div className="mt-4 text-center">
        <Link
          href="/welcome"
          className="font-mono text-[11px] uppercase tracking-widest text-hive-muted hover:text-hive-amber"
        >
          first time? open the guided wizard →
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import { notify } from "@/lib/ui/notify";

type Props = {
  output: string;
};

export function FinalOutputPanel({ output }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      notify.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Copy failed");
    }
  }

  return (
    <section className="animate-enter overflow-hidden rounded-lg border border-primary/30 bg-surface-1 shadow-bevel">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-primary-soft px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-primary">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 1.5v3M7 9.5v3M1.5 7h3M9.5 7h3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Final output
        </h2>
        <button
          type="button"
          onClick={() => void copy()}
          className="h-7 rounded-md border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </header>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-relaxed text-foreground/90">
        {output}
      </pre>
    </section>
  );
}

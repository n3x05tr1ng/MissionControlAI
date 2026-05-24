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
    <section className="border-2 border-hive-amber/60 bg-hive-panel">
      <header className="flex items-center justify-between gap-2 border-b border-hive-amber/40 px-4 py-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
          [ FINAL OUTPUT ]
        </h2>
        <button
          type="button"
          onClick={() => void copy()}
          className="border border-hive-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-text"
        >
          {copied ? "copied" : "copy"}
        </button>
      </header>
      <pre className="max-h-[60vh] overflow-auto p-4 font-mono text-xs text-hive-text/90 whitespace-pre-wrap">
        {output}
      </pre>
    </section>
  );
}

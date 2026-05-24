"use client";

import Link from "next/link";
import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalRouteError({ error, reset }: Props) {
  useEffect(() => {
    // Log to the console; the dev terminal will show it. No remote telemetry.
    // eslint-disable-next-line no-console
    console.error("[Hive] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-xl border border-red-500/60 bg-hive-panel p-5 flex flex-col gap-4">
        <h1 className="font-mono text-[11px] uppercase tracking-widest text-red-400">
          [ SOMETHING WENT WRONG ]
        </h1>
        <pre className="border border-hive-border bg-hive-bg/60 p-3 font-mono text-xs text-hive-text whitespace-pre-wrap break-words">
          {error.message || "Unknown error"}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="border border-hive-amber bg-hive-amber/10 px-3 py-1 text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20"
          >
            Reload
          </button>
          <Link
            href="/"
            className="border border-hive-border px-3 py-1 text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

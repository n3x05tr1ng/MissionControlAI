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
    console.error("[Hive] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="animate-enter flex w-full max-w-xl flex-col gap-4 rounded-lg border border-destructive/40 bg-surface-1 p-5 shadow-bevel">
        <div>
          <p className="hive-overline text-destructive">[ Route error ]</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
            Something went wrong
          </h1>
        </div>
        <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 p-3 font-mono text-xs text-foreground">
          {error.message || "Unknown error"}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Reload
          </button>
          <Link
            href="/"
            className="flex h-8 items-center rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

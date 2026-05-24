"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Renders when an error escapes the root layout itself (very rare).
// Must include its own <html>/<body> per Next conventions.
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[Hive] global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0b0d0f",
          color: "#e6e6e6",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            border: "1px solid rgba(255, 92, 92, 0.6)",
            background: "#13161a",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h1
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#ff5c5c",
              margin: 0,
            }}
          >
            [ HIVE CRASHED ]
          </h1>
          <pre
            style={{
              border: "1px solid #23282e",
              background: "#0b0d0f",
              padding: 12,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {error.message || "Unknown error"}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <div>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: "1px solid #FFB000",
                background: "rgba(255, 176, 0, 0.1)",
                color: "#FFB000",
                padding: "6px 12px",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

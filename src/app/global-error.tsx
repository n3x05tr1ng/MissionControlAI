"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Renders when an error escapes the root layout itself (very rare).
// Must include its own <html>/<body> per Next conventions; globals.css may
// not be loaded here, so it uses inline styles with the token values.
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[Hive] global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#121211",
          color: "#f2f1ee",
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
            border: "1px solid rgba(244, 110, 92, 0.4)",
            background: "#1a1a18",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h1
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#f46e5c",
              margin: 0,
            }}
          >
            [ Hive crashed ]
          </h1>
          <pre
            style={{
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background: "#121211",
              borderRadius: 8,
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
                border: "none",
                background: "#e3a44e",
                color: "#26190a",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 500,
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

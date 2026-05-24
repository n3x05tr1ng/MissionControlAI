"use client";

import { Toaster as SonnerToaster } from "sonner";

// Single instance mounted from app/layout.tsx. Themed to match Hive.
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      richColors={false}
      closeButton
      toastOptions={{
        style: {
          background: "#13161a",
          border: "1px solid #23282e",
          color: "#e6e6e6",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          letterSpacing: "0.04em",
        },
        classNames: {
          success: "hive-toast-success",
          error: "hive-toast-error",
        },
      }}
    />
  );
}

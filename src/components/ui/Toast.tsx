"use client";

import { Toaster as SonnerToaster } from "sonner";

// Single instance mounted from app/layout.tsx.
// Tematizado 100% con tokens CSS — nada de hex hardcodeados.
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      richColors={false}
      closeButton
      toastOptions={{
        style: {
          background: "var(--glass-bg)",
          backdropFilter: "blur(var(--glass-blur)) saturate(1.4)",
          WebkitBackdropFilter: "blur(var(--glass-blur)) saturate(1.4)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-overlay)",
          color: "var(--foreground)",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        },
        classNames: {
          success: "hive-toast-success",
          error: "hive-toast-error",
        },
      }}
    />
  );
}

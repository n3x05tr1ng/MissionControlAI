import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone: el empaquetado desktop (Tauri) corre .next/standalone/server.js
  // sin cargar los 800MB de node_modules; next start sigue funcionando igual.
  output: "standalone",
};

export default nextConfig;

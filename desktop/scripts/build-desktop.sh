#!/usr/bin/env bash
#
# build-desktop.sh — assemble the Hive desktop bundle and (optionally) build the
# macOS .app/.dmg. Hive's web app is a REAL Next server (API routes, SSE, SQLite,
# the Claude Agent SDK), so unlike a static SPA it cannot be exported to files —
# the desktop app ships the `next build` standalone server AND the embedded
# terminal server, both run by a single bundled `node` binary (see src/lib.rs).
#
# Layout produced under desktop/src-tauri/:
#   binaries/hive-node-<triple>      the bundled Node runtime (externalBin)
#   next-runtime/                    .next/standalone + .next/static + public
#   terminal-runtime/                terminal-server.mjs + node_modules (pty/sqlite/ws)
#
# Usage:
#   bash scripts/build-desktop.sh assemble   # stage runtimes + node, no cargo build
#   bash scripts/build-desktop.sh build      # assemble, then `tauri build`
#
# Requirements: Node >= 18 (you have v22), Rust + cargo, the Tauri CLI (this dir's
# devDependency, or global), and Xcode Command Line Tools.

set -euo pipefail

# The fixed loopback port for the embedded terminal. MUST match TERMINAL_PORT in
# src-tauri/src/lib.rs — the frontend bakes it in as NEXT_PUBLIC_HIVE_TERMINAL_PORT
# and the browser reads it to build the ws:// URL.
TERMINAL_PORT=47821

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DESKTOP_DIR}/.." && pwd)"
TAURI_DIR="${DESKTOP_DIR}/src-tauri"
TRIPLE="$(rustc -vV | sed -n 's/host: //p')"   # e.g. aarch64-apple-darwin

echo "==> Hive desktop assembly"
echo "    repo    : ${REPO_ROOT}"
echo "    triple  : ${TRIPLE}"
echo "    term port: ${TERMINAL_PORT}"

# 1) Build the Next standalone server with the fixed terminal port baked in.
echo "==> next build (output: standalone, NEXT_PUBLIC_HIVE_TERMINAL_PORT=${TERMINAL_PORT})"
( cd "${REPO_ROOT}" && NEXT_PUBLIC_HIVE_TERMINAL_PORT="${TERMINAL_PORT}" npm run build )

[ -f "${REPO_ROOT}/.next/standalone/server.js" ] || {
  echo "ERROR: .next/standalone/server.js missing — is output:'standalone' set in next.config.ts?" >&2
  exit 1
}

# 2) Assemble next-runtime/ = standalone + static + public.
echo "==> staging next-runtime/"
NEXT_RT="${TAURI_DIR}/next-runtime"
rm -rf "${NEXT_RT}"; mkdir -p "${NEXT_RT}"
cp -R "${REPO_ROOT}/.next/standalone/." "${NEXT_RT}/"
mkdir -p "${NEXT_RT}/.next"
cp -R "${REPO_ROOT}/.next/static" "${NEXT_RT}/.next/static"
[ -d "${REPO_ROOT}/public" ] && cp -R "${REPO_ROOT}/public" "${NEXT_RT}/public" || true

# 3) Assemble terminal-runtime/ = terminal-server.mjs + its native deps.
echo "==> staging terminal-runtime/ (node-pty, better-sqlite3, ws)"
TERM_RT="${TAURI_DIR}/terminal-runtime"
rm -rf "${TERM_RT}"; mkdir -p "${TERM_RT}"
cp "${REPO_ROOT}/scripts/terminal-server.mjs" "${TERM_RT}/terminal-server.mjs"
cat > "${TERM_RT}/package.json" <<'PKG'
{ "name": "hive-terminal-runtime", "private": true, "type": "module",
  "dependencies": { "node-pty": "*", "better-sqlite3": "*", "ws": "*" } }
PKG
# Resolve the exact installed versions from the repo so the prebuilt native
# binaries match the bundled node ABI, then install a clean isolated tree.
( cd "${TERM_RT}" && npm install --omit=dev --no-audit --no-fund \
    "node-pty@$(node -p "require('${REPO_ROOT}/node_modules/node-pty/package.json').version")" \
    "better-sqlite3@$(node -p "require('${REPO_ROOT}/node_modules/better-sqlite3/package.json').version")" \
    "ws@$(node -p "require('${REPO_ROOT}/node_modules/ws/package.json').version")" )

# 4) Bundle the Node runtime as the sidecar binary.
echo "==> bundling node -> binaries/hive-node-${TRIPLE}"
mkdir -p "${TAURI_DIR}/binaries"
cp "$(command -v node)" "${TAURI_DIR}/binaries/hive-node-${TRIPLE}"
chmod +x "${TAURI_DIR}/binaries/hive-node-${TRIPLE}"

echo "==> assembly complete"

if [ "${1:-assemble}" = "build" ]; then
  echo "==> tauri build"
  cd "${DESKTOP_DIR}"
  if [ -x "./node_modules/.bin/tauri" ]; then TAURI="./node_modules/.bin/tauri";
  elif command -v cargo-tauri >/dev/null 2>&1; then TAURI="cargo tauri";
  else TAURI="tauri"; fi
  ${TAURI} build
  echo "==> done — see src-tauri/target/release/bundle/"
fi

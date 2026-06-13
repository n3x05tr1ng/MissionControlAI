# Hive Desktop (Tauri v2)

A downloadable macOS build of **Hive** (MissionControlAI). Unlike Infuse, Hive's
web app is a **real Next server** — API routes, SSE streams, a `better-sqlite3`
data layer, and the Claude Agent SDK — so it can **not** be exported to static
files. Instead the desktop app runs the production **Next standalone server** and
the **embedded-terminal server** as two Node sidecars, supervised by a small Rust
(Tauri) shell.

```
┌──────────────────────────── Hive.app ─────────────────────────────┐
│  Tauri webview ──HTTP──►  node next-runtime/server.js   (UI, :dynamic) │
│                 ──WS────►  node terminal-runtime/                      │
│                            terminal-server.mjs          (:47821 fixed) │
│                                                                        │
│  Both Node children run off ONE bundled `node` binary (externalBin).   │
│  SQLite vault @ ~/Library/Application Support/com.hive.desktop/        │
│  Rust shell waits for the Next server's GET / 200, navigates the       │
│  window to it, and SIGTERM-kills BOTH children (and their PTYs) on quit.│
└────────────────────────────────────────────────────────────────────────┘
```

## Why two sidecars + a bundled node

- **Next standalone, not static export.** `next build` with `output: "standalone"`
  (already set in `next.config.ts`) emits a self-contained `server.js` plus a
  trimmed `node_modules` (it correctly traces `better-sqlite3` and its native
  `.node`). The webview loads `http://127.0.0.1:<dynamic port>`.
- **Separate terminal server.** `scripts/terminal-server.mjs` bridges PTYs (via
  `node-pty`) to WebSockets and reads the projects DB (`better-sqlite3`). Next
  does not trace it, so it is staged with its own minimal `node_modules`.
- **Fixed terminal port (47821).** The browser builds the `ws://…/terminal` URL
  from `NEXT_PUBLIC_HIVE_TERMINAL_PORT`, which is **baked at build time** — so the
  terminal port must be fixed and must match `TERMINAL_PORT` in `src/lib.rs`. The
  Next server port stays dynamic (the shell hands the live URL to the webview).
- **Bundled `node`.** A copy of your `node` binary ships as the sidecar so the app
  is self-contained; the prebuilt native addons (`node-pty`, `better-sqlite3`) are
  installed against that same Node ABI by `build-desktop.sh`.

## External dependency: the `claude` CLI

The embedded terminal spawns **Claude Code** in your project directories. Hive
does **not** bundle it — `terminal-server.mjs` resolves `claude` from your login
shell `PATH` (or `~/.nvm/.../bin`, Homebrew). Install Claude Code on the machine
that runs Hive. A plain `shell` session works without it.

## Build (Apple Silicon)

Prerequisites: Xcode Command Line Tools, Rust + cargo, Node ≥ 18 (you have v22),
and the Tauri CLI (this dir's devDependency: `npm install` here once, or global).

```bash
cd desktop
npm install                 # Tauri CLI (once)
npm run build               # = bash scripts/build-desktop.sh build
#   -> src-tauri/target/release/bundle/macos/Hive.app
#   -> src-tauri/target/release/bundle/dmg/Hive_0.1.0_aarch64.dmg
```

`scripts/build-desktop.sh` (1) runs `next build` with the fixed terminal port
baked in, (2) stages `next-runtime/` (standalone + `.next/static` + `public`),
(3) stages `terminal-runtime/` (terminal-server.mjs + node-pty/better-sqlite3/ws),
(4) copies your `node` into `binaries/hive-node-<triple>`, then runs `tauri build`.
Run only steps 1–4 with `npm run assemble`.

### Gatekeeper (un-signed local build)

`tauri.conf.json` sets no signing identity → the build is ad-hoc signed and not
notarized. It runs on the build machine after `xattr -dr com.apple.quarantine
/Applications/Hive.app` (or right-click → Open). To distribute without warnings,
add an Apple Developer ID `signingIdentity` and notarize (see
<https://tauri.app/distribute/sign/macos/>).

## Data on disk

| Path | What |
|------|------|
| `~/Library/Application Support/com.hive.desktop/hive.db` | the local SQLite vault (projects, sessions, tasks, automations…) |

`HIVE_DATA_DIR` is set by the Rust shell to that dir; the schema auto-creates on
first launch (`src/lib/db.ts`).

## Pending product decision (carried from the audit)

The in-app **cron scheduler** (`node-cron`, automations) only runs while the
window is open — closing Hive stops scheduled automations. If you want them to
fire while Hive is closed, the options are a macOS **LaunchAgent** that keeps the
Next server alive headless, or a **menu-bar** mode. Left as a deliberate choice;
the current build matches the app's existing "runs while open" behaviour.

## What's verified vs. not

| Thing | Status |
|-------|--------|
| Tauri crate compiles (`cargo build` release) + unit tests | ✅ |
| `next build` standalone + asset/terminal-runtime assembly | ✅ scripted & run |
| `Hive.app` / `.dmg` bundle | ✅ built (arm64, ad-hoc signed) |
| Next sidecar serves the UI; terminal sidecar answers `/healthz`; both die on quit | ✅ smoke-tested headless |
| Embedded terminal end-to-end (spawns Claude in a project, streams to xterm) | ⚠️ needs a visual run — depends on `claude` being installed |

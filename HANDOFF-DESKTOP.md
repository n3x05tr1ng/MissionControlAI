# HANDOFF — Hive (MissionControlAI) Desktop (renovación 2026-06)

> Documento autocontenido para retomar/reconstruir Hive. Vive DENTRO del repo a
> propósito (viaja con el proyecto y queda en los `git bundle`).
> **Backup 2026-06-13** por riesgo de borrado de iCloud: ver §6.
> ⚠️ Este proyecto usa **Next 16** (breaking changes): leer `node_modules/next/dist/docs/` antes de tocar código del web app (lo exige `AGENTS.md`).

## Estado
- Rama de trabajo: **`renovacion-ui`** · último commit del desktop: **`c9a5c43`**.
- Renovación completa: seguridad+bugs (Fase A: cerrado RCE por WS hijacking, SSE, scheduler), rediseño UI 100% "AI Desktop Native" ámbar (Fase B), **app de escritorio macOS (Fase C)**, verificación (Fase D). **Falta solo el merge a `main`** (pendiente de aprobación).
- Entregado: `Hive.app` + `Hive_0.1.0_aarch64.dmg` (arm64, ~242MB), instalado en `/Applications`, dmg en `~/Desktop`.

## Arquitectura desktop (Tauri v2 + 2 sidecars Node)
Hive NO es exportable a estático (server Next real: API routes, SSE, SQLite, Claude Agent SDK). El shell Tauri corre **dos procesos Node sobre un `node` bundleado**:
1. `node next-runtime/server.js` (Next standalone) en puerto **dinámico**; el webview navega ahí tras el health-check (`GET /`→2xx).
2. `node terminal-runtime/terminal-server.mjs` (PTY↔WebSocket) en puerto **FIJO 47821** (horneado como `NEXT_PUBLIC_HIVE_TERMINAL_PORT`; el browser lo lee en `src/components/EmbeddedTerminal.tsx`).

`lib.rs` los spawnea con `std::process` (cada uno con hilo supervisor que hace `wait()`, sin zombies), pasa `HIVE_DATA_DIR=<app-data>` y `HIVE_ALLOWED_ORIGINS=<origen Next>`, y mata ambos al salir (`CloseRequested`+`ExitRequested|Exit`, SIGTERM+SIGKILL por PID). El terminal lanza `claude` resolviéndolo del login-shell PATH.

## Scaffold (commit c9a5c43, carpeta `desktop/` nueva — 30 archivos comiteados)
`src-tauri/{src/lib.rs, src/main.rs, build.rs, Cargo.toml, Cargo.lock, tauri.conf.json, capabilities/default.json, icons/}`, `scripts/build-desktop.sh`, `frontend/index.html` (splash), `package.json`, `README.md`. **`Cargo.lock` tiene `time` pineado a 0.3.47** (0.3.48+ rompe `tauri-utils` 2.9.2 con E0119). `serde_json` es dep directa obligatoria (lo exige `generate_context!`).

## Reconstruir el .app/.dmg
`export PATH="$HOME/.cargo/bin:$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`
```bash
cd desktop && npm install            # Tauri CLI (gitignored)
npm run build                        # = bash scripts/build-desktop.sh build
```
`build-desktop.sh` hace TODO: `next build` (con `NEXT_PUBLIC_HIVE_TERMINAL_PORT=47821`) → `next-runtime/` (standalone+static+public); `terminal-runtime/` (npm i node-pty/better-sqlite3/ws con prebuilds nativos arm64); copia `node` → `binaries/hive-node-<triple>`; `tauri build`. (Por EPERM, conviene copiar el repo a `/tmp` y usar `CARGO_TARGET_DIR=/tmp/...`.) Solo ensamblar: `npm run assemble`.

**Smoke test (headless):** Next 16 cambia `process.title` a `next-server`, así que **`pgrep hive-node` NO encuentra el sidecar Next** — buscar por PUERTO: `lsof -nP -iTCP -sTCP:LISTEN | grep hive-node` (2 esperados: `:47821` + uno dinámico). `curl <puerto>/`→200; `curl :47821/healthz`→`{"ok":true}`; quit → ambos desaparecen.

## Datos / gitignored (NO en el repo)
- `desktop/src-tauri/binaries/hive-node-*` (109MB), `next-runtime/`, `terminal-runtime/`, `node_modules` (todos los regenera `build-desktop.sh`/`npm install`).
- `data/hive.db` (proyectos/sesiones/tasks/automations — **datos reales, respaldar**). En desktop la DB vive en `~/Library/Application Support/com.hive.desktop/hive.db`.
- Iconos = **placeholder** (de Infuse). Reemplazar por ámbar: `./node_modules/.bin/tauri icon logo.png`.

## Pendiente (no bloquea uso)
Merge a `main`; prueba VISUAL del terminal lanzando `claude`; iconos ámbar; decisión scheduler (corre solo con ventana abierta → LaunchAgent o menu-bar, ver `desktop/README.md`); firmar/notarizar para distribuir.

## §6 Backup y cómo continuar tras mover (iCloud)
- Backup verificado: **`~/RepoBackups/MissionControlAI-Hive-2026-06-13.bundle`**. Restaurar: `git clone MissionControlAI-Hive-2026-06-13.bundle MissionControlAI && cd MissionControlAI && git checkout renovacion-ui`.
- Recomendación fuerte: tras el backup, **mover el repo FUERA de iCloud** (ej. `~/Developer/`) — también elimina el EPERM intermitente de Documents.
- Tras mover: `git status` (limpio salvo `?? .claude/launch.json`), `npm install` en raíz y en `desktop/`, reconstruir con los comandos de arriba.

Contraparte (Infuse) y detalle global del entorno: `Documents/Projects/_renovacion-handoff/CONTINUACION-2026-06-13.md`.

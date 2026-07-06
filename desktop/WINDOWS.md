# Hive Desktop — Windows

## Estado

- **Código preparado**: teardown Windows (`taskkill /T /F`) en `src-tauri/src/lib.rs`,
  sufijo `.exe` para el sidecar node en `scripts/build-desktop.sh`, bundler NSIS
  vía `TAURI_BUNDLES=nsis`. `cargo check` pasa en macOS (ramas Windows gated).
- **Build**: NO se puede cross-compilar desde macOS. Usa el workflow
  `.github/workflows/desktop-windows.yml`:
  1. Push del repo a GitHub.
  2. GitHub → Actions → **desktop-windows** → *Run workflow* (o push de un tag
     `desktop-v*`).
  3. Descarga el artifact **hive-windows-installer** (instalador NSIS `.exe`).

## Auditoría pendiente en Windows real (checklist)

- [ ] El instalador NSIS instala y la app abre (splash → dashboard).
- [ ] Los 2 sidecars Node arrancan (puertos: dinámico + 47821).
- [ ] Cerrar la ventana mata AMBOS procesos (`tasklist | findstr node`).
- [ ] Terminal embebido: node-pty trae prebuilds win32-x64 ✓, pero la
      resolución del CLI `claude` usa zsh en `scripts/terminal-server.mjs` —
      en Windows cae al nombre `claude`; si el spawn falla, instalar el CLI y/o
      definir `HIVE_CLAUDE_PATH` apuntando a `claude.cmd`. (La UI ya muestra el
      error exacto si esto falla.)
- [ ] SQLite en `%APPDATA%/com.hive.desktop/`.

## Firmar (opcional)

El instalador sale sin firmar (SmartScreen avisará). Para firmar: certificado
code-signing + `signCommand` en `tauri.conf.json > bundle > windows`.

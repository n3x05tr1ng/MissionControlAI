# CÓMO USAR HIVE — guía paso a paso

> Hive es tu **centro de mando para agentes de IA**: corre Claude en varios
> proyectos a la vez, con tablero Kanban, terminal embebido, panel de git,
> tareas recurrentes y un asistente que ve toda tu cartera.
>
> Hay dos formas de usarlo: **app de escritorio** (`Hive.app`) o **web app
> local** (`npm run dev`). Ambas guardan los datos en SQLite local — nada sale
> de tu Mac.

---

## 1. Requisitos

| Qué | Para qué | ¿Obligatorio? |
|---|---|---|
| Node.js 20+ | correr la web app | Sí (solo web; el .app trae el suyo) |
| Claude Code CLI (`claude`) | motor de los agentes y terminal | Sí — `npm i -g @anthropic-ai/claude-code` |
| API key de Anthropic | SOLO el chat "Assistant" | No — todo lo demás usa tu suscripción de Claude |

## 2. Arrancar

### Opción A — App de escritorio (recomendada)

1. Abre `Hive.app` (o monta `Hive_0.1.0_aarch64.dmg` y arrastra a Applications).
2. Primera vez: macOS puede bloquearla (no está firmada). Solución:
   ```bash
   xattr -dr com.apple.quarantine /Applications/Hive.app
   ```
3. Espera el splash (~10 s) — arranca un servidor interno y se abre solo.

### Opción B — Web app (para desarrollo o para compartir)

```bash
cd MissionControlAI
npm install
npm run dev          # → http://localhost:3000
# ¿Puerto 3000 ocupado? PORT=3200 npm run dev  (el terminal se ajusta solo)
```

## 3. Primer uso (5 minutos)

1. **Onboarding**: si es instalación nueva, `/welcome` te guía en 4 pasos
   (primer proyecto → API key opcional → perfil de agente → listo).
2. **Crea un proyecto**: botón **+ New project** en el Dashboard → dale nombre
   y apunta **Path** a una carpeta real de código (usa **Browse**). También hay
   **Bulk import** para importar varias carpetas de golpe.
3. **Ejecuta tu primera tarea**: entra al proyecto → escribe en **Compose a
   task** ("añade un README", por ejemplo) → **⌘↵**. Verás el run en vivo.
4. **Abre el terminal embebido**: en la misma página, abajo. Botones:
   `claude` (sesión nueva), `claude --resume` (continuar), `shell` (zsh).
   Es un Claude Code REAL corriendo en la carpeta del proyecto.

## 4. Flujos principales

### Tablero Kanban (`/board`)
- **New task** → título + proyecto + perfil de agente (opcional) + prompt.
- Columnas: Backlog → Ready → **Running** → Review → Done (drag & drop).
- Al soltar una tarjeta en Running, el agente arranca solo. En Review apruebas
  el resultado.
- Tareas **recurrentes**: al crear la tarea marca "Recurring" y elige el cron
  visual (ej. "cada día 9am"). ⚠️ Solo corren mientras Hive esté abierto.

### Perfiles de agente (`/profiles`)
11 perfiles listos (Bug Hunter, Code Reviewer, Doc Writer, Refactorer…).
Cada uno define system prompt + modelo + herramientas + límites de costo.
**Duplica un template** y ajústalo. Se asignan por tarea en el Board.

### Automations (`/automations`)
Pipelines multi-paso: agente → agente → revisión humana. Empieza con un
template ("Bug Triage Loop", "Daily Project Standup") y edítalo.

### Asistente de cartera (`/assistant`)
Chat que ve TODOS tus proyectos ("¿en qué debería trabajar?", "recuérdame
revisar X mañana"). Único sitio que necesita la API key (Settings → API key).

### Git panel
En cada proyecto, pestaña **Git**: stage, commit, push/pull, branches, log —
sin salir de Hive.

### Atajos
- **⌘K** — paleta de comandos (navegar, crear, saltar a cualquier proyecto).
- **?** — cheatsheet de atajos (abajo a la derecha).

## 5. Use cases reales

1. **Mantener 5 side-projects a la vez**: un proyecto Hive por repo; encola
   "actualiza dependencias y corre los tests" en los 5; revisa los diffs en
   Review mientras tomas café.
2. **Standup automático**: Automation "Daily Project Standup" cada mañana —
   lee la actividad y escribe un resumen en `.claude/handoff.md`.
3. **Bug triage nocturno**: perfil Bug Hunter + tarea recurrente a las 2am
   sobre el repo con issues; a la mañana ves PRs propuestos en Review.
4. **Proyecto nuevo sin abrir la terminal**: New project → Compose a task
   ("scaffoldea una app Next con auth") → mira el run → abre el terminal
   embebido para retocar.
5. **Nudges anti-abandono**: `/reminders` — auto-nudge te avisa cuando un
   proyecto lleva N días sin actividad.

## 6. Dark / Light

Botón sol/luna arriba a la derecha. Se recuerda entre sesiones. El terminal
embebido siempre es oscuro (a propósito, como los IDE).

## 7. Problemas comunes

| Síntoma | Causa | Arreglo |
|---|---|---|
| Terminal dice "Could not start claude" | CLI no instalado | `npm i -g @anthropic-ai/claude-code` |
| Terminal: "Project folder does not exist" | moviste la carpeta del proyecto | tarjeta del proyecto → menú ⋯ → Edit → corrige el Path |
| Terminal "disconnected" tras `npm install` | permiso de ejecución perdido en node-pty | `npm install` de nuevo (el postinstall lo arregla) o `chmod +x node_modules/node-pty/prebuilds/*/spawn-helper` |
| Puerto 3000 ocupado / página rara | otro servicio usa 3000 | `PORT=3200 npm run dev` |
| "anthropic not configured" arriba | falta API key | solo afecta al Assistant; Settings → API key |
| La app de macOS no abre | Gatekeeper (sin firma) | `xattr -dr com.apple.quarantine /Applications/Hive.app` |
| Tareas recurrentes no corrieron | Hive estaba cerrado | el scheduler solo corre con la app abierta (limitación conocida) |

## 8. Dónde viven mis datos

- Web app: `MissionControlAI/data/hive.db` (SQLite).
- Desktop: `~/Library/Application Support/com.hive.desktop/hive.db`.
- Por proyecto: `.claude/state.json` y `.claude/handoff.md` dentro de tu repo
  (editables desde la pestaña Handoff).

## 9. Compartir / publicar en GitHub

La web app es 100% compartible: el repo entero ES la web app (Next.js).
`git push` a GitHub y cualquiera con Node puede `npm install && npm run dev`.
No subas `data/` (está en .gitignore — contiene tu DB con tus API keys).

## 10. Rebranding

Nombre, logo y colores son placeholders → **BRANDING.md** tiene el checklist
completo (1 archivo para el nombre, 1 SVG para el logo, 2 bloques CSS para
los colores, `tauri icon` para el .app).

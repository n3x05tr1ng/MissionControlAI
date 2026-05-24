# 🐝 Hive

> The single command center for every AI coding agent you run in parallel.
> Un solo centro de mando para todos los agentes de IA que corres en paralelo.

![Dashboard screenshot](docs/screenshot-dashboard.png)
![Board screenshot](docs/screenshot-board.png)

---

## What's new in v0.3 / Novedades en v0.3

- **Zero config files.** Projects, profiles, settings, automations — everything
  lives in SQLite now. No more `app.config.json` / `projects.config.json` /
  `workflows/*.yaml`. The `/settings` page is the single source of truth.
- **Onboarding wizard** at `/welcome` that walks you through your first project,
  API key, and Agent Profile in four steps.
- **Agent Profiles** — 11 reusable profiles (10 curated templates + a generic
  default) with system prompt, model, tools, MCP servers and cost caps. Editable,
  duplicable, exportable.
- **Recurring tasks** with a visual cron picker — workflow YAML files are gone.
- **Cmd+K command palette** that navigates, creates, and jumps to any project
  or profile.
- **Embedded git panel** on every project (status, branches, stage / commit /
  push / pull, log).
- **Inline editors** for `.claude/state.json` and `.claude/handoff.md`.
- **Realtime Kanban + dashboard** via SSE — no more 4 s polling.
- **Toasts, confirm dialogs, skeletons, and a global error boundary.**
- **Stats** — KPI cards + 14-day runs chart on the dashboard, usage per profile,
  activity per project.

---

## What is Hive? / ¿Qué es Hive?

**EN** — Hive is a local-first command center for running AI coding agents on
multiple projects at the same time. It wraps the
[`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk),
a Kanban board for multi-agent task orchestration, a built-in PTY terminal, a
git panel, recurring tasks, and a portfolio-wide assistant — all behind a
keyboard-driven, terminal-aesthetic UI.

**ES** — Hive es un centro de mando local para correr agentes de IA en varios
proyectos al mismo tiempo. Integra el SDK oficial de Claude Code, un tablero
Kanban para orquestar tareas multi-agente, un terminal PTY embebido, un panel
de git, tareas recurrentes y un asistente que ve toda tu cartera — todo bajo
una UI estilo terminal manejada por teclado.

---

## Features / Funciones

- **Dashboard / Tablero principal** — every project at a glance, KPIs, recent
  activity, 14-day run chart.
- **Per-project view / Vista por proyecto** — engine activity, prompt composer,
  embedded terminal, git panel, inline `.claude/` editors.
- **Kanban board / Tablero Kanban** (`/board`) — 5 columns
  (Backlog → Ready → Running → Review → Done), drag & drop, per-task profile,
  optional cron schedule, realtime updates via SSE.
- **Agent Profiles** (`/profiles`) — create, edit, duplicate, export and import
  reusable agent definitions (system prompt + model + tools + MCP + caps).
- **Reminders & auto-nudges / Recordatorios y nudges automáticos**
  (`/reminders`) — manual reminders + a scheduler that pings stale projects.
- **Portfolio assistant / Asistente de cartera** (`/assistant`) — chat over all
  projects with tools for projects, reminders, runs, and recurring tasks.
- **Settings / Ajustes** (`/settings`) — Anthropic key, default models, MCP
  servers, onboarding reset.
- **Cmd+K command palette** — global keyboard navigation.
- **`?` cheatsheet** — keyboard shortcuts overlay (bottom-right).

---

## Quick start / Inicio rápido

```bash
git clone <repo-url> hive
cd hive
npm install
npm run dev
```

Open <http://localhost:3000>. On the first run you'll be redirected to
`/welcome`; finish the four-step wizard (project → API key → Agent Profile)
and you're in.

`npm run dev` boots both Next.js and the embedded terminal websocket server
(port 3001) in a single process via `scripts/dev.mjs`.

---

## Managing projects / Gestionando proyectos

**EN** — Add a project from the dashboard (`+ New project` button) or from
inside the welcome wizard. Use the file browser (`<PathPicker>`) to navigate
your filesystem, or the git-repo scanner (`<RepoScanner>`) to bulk-import every
`.git` repository under a parent folder. You can also drag files / folders from
Finder onto the browser. Every project persists in SQLite — no JSON files to
edit by hand.

**ES** — Añade un proyecto desde el dashboard o desde el wizard inicial. Usa
el explorador de archivos (`<PathPicker>`) para navegar tu disco, o el escáner
de repositorios (`<RepoScanner>`) para importar todos los `.git` bajo una
carpeta padre. También puedes arrastrar carpetas desde Finder. Todo se guarda
en SQLite — no hay JSON que tocar.

---

## Agent Profiles / Perfiles de agente

A **profile** is a reusable bundle of `(system prompt, model, tools, MCP
servers, permission mode, cost cap, sandbox)`. Hive ships 10 curated templates
— *Code Reviewer*, *Bug Hunter*, *Doc Writer*, *Refactorer*, *Test Engineer*,
*DevOps Helper*, *Researcher*, *Architect*, *Code Explainer*, *Daily
Summarizer* — plus one *default*. Manage them at `/profiles`: create from
scratch or from a template, edit, duplicate, export as JSON, import.

Every Task references a `profile_id`; you can run the same profile across many
projects without copy-pasting prompts.

---

## Recurring tasks / Tareas recurrentes

Open the *New task* modal on `/board` (or via Cmd+K → *New task*). The
**Repeat** picker lets you mark the task as a recurring template with a cron
schedule (presets: every day, weekdays at 9 am, every Monday, custom cron…).
The in-process scheduler instantiates a new task off the template at every fire
time. Recurring tasks have replaced the old YAML automations entirely.

---

## Embedded terminal / Terminal embebido

Each project has a built-in PTY terminal (xterm.js + `node-pty` over a small
WebSocket server on port 3001). Use it to run `claude`, `git`, `npm`, anything
— without leaving the dashboard. A **STOP** button hard-kills the active PTY
when needed.

---

## Git panel / Panel de git

Every project view exposes a `GitPanel`: working-tree status, branch list,
stage / unstage, commit, push, pull, and the last 50 commits. Backed by
`simple-git`. No CLI required for routine work.

---

## The Assistant / El Asistente

`/assistant` is a chat over your whole portfolio. It uses the Messages API
with tools for projects, reminders, runs, and recurring tasks — ask things
like *"resume what each project did this week"* or *"create a reminder for
hive to update its README"*.

---

## Inline editors / Editores en línea

From a project view you can edit `.claude/state.json` and `.claude/handoff.md`
directly without leaving the browser. Changes are atomic and reflect
immediately on the activity feed.

---

## Data contracts / Contratos de datos

See [`docs/plan/02-contracts.md`](docs/plan/02-contracts.md) for the original
contract definitions.

> **Heads up — v0.3 evolution.** Contracts have grown since v0.1:
>
> - `projects` is **DB-backed**; the old `projects.config.json` is dead.
> - New table `agent_profiles` (the unit referenced by every task).
> - `tasks` now has `profile_id` and an optional `schedule` (cron) +
>   `recurring_template` flag.
> - `workflows` / `workflow_runs` tables are kept for back-compat but no
>   longer surfaced in the UI.

The live SQLite schema is in `src/lib/db/migrations/` if you want bytes-on-disk
truth.

---

## SessionStart hook

Hive writes `.claude/state.json` / `.claude/handoff.md` on every run. To have
your local `claude` CLI auto-load that context on startup, drop the snippet
below into `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "node $HOME/Documents/MissionControlAI/scripts/session-start.mjs"
          }
        ]
      }
    ]
  }
}
```

---

## Roadmap

- **v0.1** ✅ Engine, prompt composer, workflows, assistant, reminders.
- **v0.2** ✅ DB-backed projects, embedded terminal, kanban, multi-agent
  tasks.
- **v0.3** ✅ Zero-config, onboarding wizard, agent profiles, recurring tasks,
  realtime SSE, command palette, git panel, inline editors, stats.
- **v0.4** (planned)
  - Plugin system for third-party providers.
  - Codex / Aider / Cursor-CLI adapters next to Claude Code.
  - Per-task sandboxing (proot / firejail / Docker).
  - PWA + push notifications.
  - Shareable profile gallery.

---

## License

MIT — see [`LICENSE`](LICENSE).

# Changelog

All notable changes to Hive are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-23

### Added

- **Agent Profiles** as first-class entities. New table `agent_profiles`,
  10 curated templates (`Code Reviewer`, `Bug Hunter`, `Doc Writer`,
  `Refactorer`, `Test Engineer`, `DevOps Helper`, `Researcher`, `Architect`,
  `Code Explainer`, `Daily Summarizer`) + 1 `default`. Editor at
  `/profiles/[id]` with system prompt, model, tools, MCP servers,
  permission mode, cost cap and sandbox. Duplicate, export and import as JSON.
- **Recurring tasks**: tasks now reference `profile_id` and can carry a
  `schedule` (cron) + `recurring_template` flag. Visual cron picker
  (`RepeatPicker`) with weekday / daily / weekly / monthly presets.
- **Onboarding wizard** at `/welcome` — 4 steps (welcome → first project →
  Anthropic key → first profile). Runs once; `onboarding_done` flag in
  `settings`.
- **File browser** (`<PathPicker>`) and **git-repo scanner**
  (`<RepoScanner>`) — no more typing absolute paths.
- **Cmd+K command palette** with global nav, quick-create actions, and
  dynamic project / profile entries.
- **Embedded git panel** on each project (status, branches, stage / commit /
  push / pull, log) backed by `simple-git`.
- **Inline editors** for `.claude/state.json` and `.claude/handoff.md`.
- **SSE realtime** for the Kanban (`/api/tasks/stream`) and dashboard
  (`/api/projects/stream`).
- **Toasts** via `sonner`, **confirm dialogs**, loading **skeletons**,
  and a global **error boundary**.
- **STOP** button + **background runs widget** in the sidebar.
- **Stats**: KPI cards + 14-day runs chart on the dashboard, per-profile
  usage panel, per-project activity chart.
- **Keyboard shortcuts cheatsheet** triggered by `?` (floating amber button
  bottom-right).
- Subtle modal fade + scale animation (~150 ms) and a global
  `transition-colors` polish for interactive elements.

### Changed

- `app.config.json` and `projects.config.json` are no longer read.
  Everything is in SQLite; `/settings` is the single source of truth.
- Tasks reference profiles instead of a hardcoded `"claude-code"` agent
  string.
- Sidebar nav and Kanban cards now have smooth color transitions on hover.

### Removed

- **Workflow YAML files** under `workflows/*.yaml`. Existing files are
  auto-imported as recurring tasks on first boot and renamed `.imported`.
  The `workflows` and `workflow_runs` tables stay for back-compat but are
  no longer surfaced in the UI.
- 4-second polling on `/board` and the dashboard — replaced by SSE.
- The "no projects" blank screen — replaced by the onboarding wizard.

## [0.2.0] - 2026-05-23

### Added

- **No more config files** — projects live in SQLite. Add/edit/delete from the dashboard (`+ New project` button + per-card `…` menu). One-shot migration from `projects.config.json` at first boot.
- **Embedded terminal** — real PTY running the local `claude` CLI (or any shell) inside the project view, via `node-pty` + `@xterm/xterm` over a small WebSocket server on port 3001.
- **Kanban board for multi-agent tasks** (`/board`) — 5 columns (Backlog → Ready → Running → Review → Done), drag-and-drop with `@dnd-kit`, per-task agent assignment, auto-move on Engine `session.end`.
- Per-project mini-board embedded in `/projects/[id]`.
- New API: `POST/PATCH/DELETE /api/projects`, `/api/tasks`, `/api/tasks/move`, `/api/providers`.
- Dev wrapper script (`scripts/dev.mjs`) spawns Next and the terminal server together via a single `npm run dev`.

### Changed

- Sidebar: "Dashboard" merged into "Projects" → `/`; new "Board" entry; "Workflows" renamed to "Automations" (route unchanged at `/workflows`).
- `loadProjectsConfig()` now reads from SQLite — the JSON file is only honored for the one-shot import.

## [0.1.0] - 2026-05-22

### Added

- Initial release.
- Dashboard with sorted project cards and per-project view (`/`, `/projects/[id]`).
- Engine integration via `@anthropic-ai/claude-agent-sdk` with live SSE activity feed and automatic `.claude/state.json` + `.claude/handoff.md` writes.
- Prompt Composer with prompt improvement, plan mode, model selection, and tool allow-list.
- Workflows engine — YAML definitions in `workflows/`, manual triggers, and cron-scheduled runs.
- AI Assistant chat over the whole portfolio (`/assistant`) backed by the Messages API, with tools for projects, reminders, runs, and workflows.
- Reminders with manual creation and an auto-nudge cron for stale projects.
- Scheduler (`node-cron`) running in-process for reminders, nudges, and workflows.
- Settings UI for Anthropic API key and default models, persisted in local SQLite.

[0.3.0]: https://github.com/your-org/hive/releases/tag/v0.3.0
[0.2.0]: https://github.com/your-org/hive/releases/tag/v0.2.0
[0.1.0]: https://github.com/your-org/hive/releases/tag/v0.1.0

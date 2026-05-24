# 03 — Phase 1: Scaffold + Read-Only Control Plane

Build the project skeleton and the read-only control plane: discover projects,
read their state files, render the two views, plus the reminders/notifications
display (read-only). No execution, no scheduler, no AI calls.

Read `01-overview.md` and `02-contracts.md` first. Start in plan mode: propose
the file structure and the `contracts.ts` types, then implement.

## Scope

1. Next.js (latest, App Router, TypeScript) single app. Tailwind, mobile-first.
   No monorepo.
2. `src/lib/contracts.ts` — all types from `02-contracts.md`.
3. `projects.config.example.json` (committed) and read logic for
   `projects.config.json` (gitignored).
4. `app.config.json` (committed) per `02-contracts.md` section 9. Leave model
   ids as placeholders with a comment to verify them.
5. SQLite at `./data/index.db` via `better-sqlite3`. Create **all** tables from
   `02-contracts.md`: `sessions`, `project_index`, `reminders`,
   `notifications`. Idempotent init/migration on startup.
6. Server-side reads only (route handlers). Client components fetch from them.

## Data reading

- On load: read `projects.config.json`. For each project:
  - Read `<path>/.claude/state.json` if present. Missing → treat as a project
    with `lastSession: null` and `status: idle`.
  - Read `<path>/.claude/handoff.md` if present. Missing → "No handoff yet".
  - Get git info (branch, dirty flag, last commit) via `simple-git`.
  - Upsert a `project_index` row.

## Views

**Global view (`/`)**
- One card per project: name, status badge, `nextStep`, last session time +
  cost, git branch + dirty indicator.
- Sort order: `blocked` and `needs-input` first, then `running`, then the rest.
- A "Reminders" panel: pending reminders (message, due date, project name).
  Display only — no create form.
- A "Recent activity" panel: last ~10 notifications, newest first.

**Project view (`/projects/[id]`)**
- Full `state.json` rendered.
- Parsed `handoff.md` by section.
- Session timeline from the `sessions` table.
- Git status.
- That project's pending reminders + its notification history.
- Placeholder panels labeled "Phase 2": a disabled "Run" button and an empty
  "Activity feed".

## Handoff parser

A utility that parses `.claude/handoff.md` into the section structure from
`02-contracts.md` section 3. Keys on `##` headings. Tolerates missing sections.

## SessionStart hook template

Add `templates/session-start-hook.md` — a short doc with a ready-to-use Claude
Code `SessionStart` hook config that `cat`s `.claude/handoff.md` so context
loads automatically when the user runs Claude Code manually inside a target
repo. This is documentation only; do not install it anywhere.

## Deliverables

- Working app: `npm run dev` serves both views.
- `contracts.ts`, `projects.config.example.json`, `app.config.json`.
- `.gitignore` covering `projects.config.json`, `data/`, `.env*`, `node_modules`,
  `.next`.
- `README.md`: what the app is, how to add a project, the data contracts, how
  to run it.
- `templates/session-start-hook.md`.

## DO NOT in this phase

- Do not install or call `@anthropic-ai/claude-agent-sdk`.
- Do not install or call `@anthropic-ai/sdk`.
- Do not build SSE streaming.
- Do not build the Prompt Composer.
- Do not build `node-cron` or `node-notifier`.
- Do not build any create/update endpoints for reminders.
- Keep this phase strictly read-only.

## Acceptance criteria

- `npm run dev` runs; `/` and `/projects/[id]` both render.
- A project with no `.claude/` folder renders without errors ("No sessions
  yet", "No handoff yet").
- Adding a project to `projects.config.json` makes it appear on next load.
- SQLite DB is created with all four tables on first run.
- Reminders and Recent-activity panels render (empty states are fine).
- README documents the contracts and the add-a-project flow.

When acceptance criteria pass: STOP. Report what was built and the real
`state.json` shape produced. Wait for the user to ask for Phase 2.

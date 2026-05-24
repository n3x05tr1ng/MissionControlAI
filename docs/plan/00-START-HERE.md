# START HERE — Build Orchestrator

You are Claude Code. You are about to build **mission-control**, a personal,
open-source, local-first web app. This folder contains the full plan. Read and
execute it in the exact order below. Do not improvise scope.

## How to use this folder

1. **Read for context (do not build yet):**
   - `01-overview.md` — what the app is, architecture, stack decisions, rationale.
   - `02-contracts.md` — the data contracts. This is the single source of truth.
     Every phase references it. If a phase and this file ever disagree, this file wins.

2. **Execute the phases ONE AT A TIME, in order:**
   - `03-phase-1-scaffold.md`
   - `04-phase-2-engine.md`
   - `05-phase-3-prompt-composer.md`
   - `06-phase-4-ai-assistant.md`
   - `07-phase-5-reminders-scheduler.md`

3. Each phase file is a self-contained build instruction with an
   **Acceptance criteria** section at the end.

## Build rules (non-negotiable)

- **One phase per run.** Build a phase fully, verify its acceptance criteria,
  then STOP. Do not start the next phase. Wait for the user to confirm and
  explicitly ask for the next phase.
- **Plan mode first.** At the start of each phase, propose the file structure
  and approach before writing code. Let the user review.
- **No phase bleed.** Each phase file has a `DO NOT in this phase` section.
  Respect it. Do not pre-build later phases "to save time".
- **Follow existing patterns.** After Phase 1, match the structure, naming, and
  conventions already in the repo. Minimal focused changes, not rewrites.
- **Never hardcode secrets.** API keys go in `.env` (gitignored). Tell the user
  exactly which env var holds the real value.
- **Verify product facts.** Before using Claude Agent SDK or Messages API
  features (Phases 2 and 4), check current official docs — the SDK surface
  changes. Cite the doc page you used.

## Project facts (constant across all phases)

- Working repo name: `mission-control` (the user may rename later).
- Single Next.js app, App Router, TypeScript. **No monorepo, no Turborepo.**
- Tailwind CSS, mobile-first responsive.
- SQLite via `better-sqlite3`, DB at `./data/index.db` (gitignored).
- **Local-first.** Runs on `localhost` only. Never deployed. No auth, no Supabase,
  no cloud services. It needs the user's local filesystem and local Claude Code
  auth — that is by design.
- The app manages multiple **target repos** (other projects). It is a control
  plane over them; it is not those repos.

## The two layers — keep them distinct

This app has two AI integrations. Do not confuse them.

| Layer | Package | Role | Built in |
|---|---|---|---|
| **Engine** | `@anthropic-ai/claude-agent-sdk` | Runs Claude Code *inside a target repo* to do real work | Phase 2 |
| **Assistant** | `@anthropic-ai/sdk` (Messages API) | Reads the portfolio, advises, creates reminders, can trigger the Engine | Phase 4 |

The Engine is the worker. The Assistant is the manager.

## First action

Open `01-overview.md` and `02-contracts.md`, read both fully, then open
`03-phase-1-scaffold.md` and begin Phase 1 in plan mode.

# 01 — Overview

## Problem

The user runs several AI/coding projects in parallel, each its own git repo,
each driven with Claude Code. Switching across them constantly loses context:
"what was I doing here, what's next, what's blocked." That context-switching is
the actual pain. This app fixes it.

## What mission-control is

A single-pane web dashboard that aggregates every project's status and "next
step", lets the user run Claude Code against any project from one place, and
captures a structured handoff at the end of every run so the next session
resumes instead of restarting.

It is **mission control between repos** — not an agent orchestrator that runs
agents inside one build.

## The core idea — handoff as a contract

The valuable part is not the embedded terminal. It is the **handoff**: a fixed,
structured record of where each project stands. The terminal is the visible
part; the handoff is what kills the overwhelm.

**State lives inside each target repo**, not in the dashboard:
- `.claude/state.json` — machine-readable status (see `02-contracts.md`).
- `.claude/handoff.md` — human-readable narrative handoff, fixed sections.

Why in the repo: versioned with the code, portable, survives the app being
deleted, and Claude Code can read it on its own (via a `SessionStart` hook) even
when the user runs Claude Code manually outside this app. The dashboard is a
**viewer + aggregator + launcher**. It does not own critical state.

## Feature set (full v1)

| Feature | Purpose |
|---|---|
| Global view | One card per project: status, next step, last run, git state. "Blocked" / "needs-input" float to top. The anti-overwhelm screen. |
| Project view | Full state, parsed handoff, session timeline, git status, run controls, live activity feed. |
| Engine (embedded execution) | Run Claude Code against a project via the Agent SDK; stream events; resume the previous session. |
| Structured handoff | At the end of every run: done / next step / blockers / open questions / files touched / context. |
| Prompt Composer | Before launch: improve the prompt, toggle plan mode, subagents, model, allowed tools. |
| AI Assistant | A chat that can read the whole portfolio, advise on priorities, and create reminders or trigger runs. |
| Reminders | Manual reminders + auto-nudges for stale projects. |
| Notifications | Native macOS notification when a run finishes or a reminder is due. |
| Timeline + cost | Per-project session history and credit/cost usage. |

## Architecture

```
Dashboard (Next.js, localhost)
  Global view ── Project view ── Prompt Composer ── Assistant chat
        │              │              │                 │
        ▼              ▼              ▼                 ▼
Backend (route handlers + SSE + cron)
  Orchestrator ── Claude Agent SDK ── Messages API ── Scheduler
        │
        ▼
SQLite (data/index.db)  ── aggregate index, timeline, reminders, notifications
        │
        ▼
Target repos (source of truth)
  repoA/.claude/{state.json, handoff.md}
  repoB/.claude/{state.json, handoff.md}
```

## Stack decisions and rationale

- **Single Next.js app, App Router.** It is one app; there are no shared
  packages. Turborepo would be ceremony with no payoff.
- **SSE for event streaming down, POST for commands up.** A run is a one-way
  stream of events to the browser. No bidirectional need → no WebSocket.
- **SQLite (`better-sqlite3`).** Synchronous, zero-config, local. Holds the
  aggregate index, session timeline, reminders, and notification history. The
  per-project source of truth stays in the repos' files.
- **Local-first, no Supabase.** The app needs the local filesystem and the
  local Claude Code auth. It cannot be deployed. Adding a cloud DB would be a
  dependency with zero benefit.
- **Engine = `@anthropic-ai/claude-agent-sdk`.** It exposes Claude Code's
  agentic engine programmatically, with session resume and structured result
  events. That is exactly the embedded-execution requirement.
- **Assistant = `@anthropic-ai/sdk` (Messages API) with tool use.** A separate,
  lighter integration. It does not run code in a repo; it reads the portfolio
  and acts through tools.

## Known limitations (accepted)

- The reminder scheduler only runs while the dev server is alive. Reminders do
  not fire when the app is closed. Acceptable for a tool used while working.
- `SessionEnd` hooks in Claude Code do not fire reliably on `/exit`. The Engine
  does not depend on `SessionEnd`; it derives state from the SDK `result` event
  and from the agent writing `handoff.md` as its final step.

## Phase map

1. Scaffold + contracts — read-only control plane, both views, registry, SQLite.
2. Engine — Agent SDK, SSE, activity feed, writes `state.json`, run-complete notification.
3. Prompt Composer — improve prompt + launch flags.
4. AI Assistant — chat over the portfolio with tools.
5. Reminders + scheduler — cron, auto-nudges, native notifications.

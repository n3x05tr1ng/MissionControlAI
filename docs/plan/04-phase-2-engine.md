# 04 — Phase 2: Execution Engine

Add embedded execution: run Claude Code against a target repo from the
dashboard, stream events live, and capture structured state when the run ends.

Read `02-contracts.md` first. Before writing code, verify the current
`@anthropic-ai/claude-agent-sdk` API from official docs
(https://platform.claude.com/docs/en/agent-sdk/typescript) — the `query()`
signature, the `result` message shape, and the `resume` option. Cite what you
used. Start in plan mode.

## Scope

1. Install `@anthropic-ai/claude-agent-sdk`.
2. Launch endpoint: `POST` that starts a run for a given `projectId` with a
   prompt and launch flags (the shape in `02-contracts.md` section 8). For now
   the prompt comes in raw; the Prompt Composer is Phase 3.
3. Run the Agent SDK `query()` with `cwd` set to the project's `path`.
4. Map launch flags to SDK options per `02-contracts.md` section 8.
5. **Resume:** if the project has a previous session id, pass the SDK `resume`
   option so the run continues the prior session instead of starting cold.
   Also prepend the previous `.claude/handoff.md` `## Context for next run`
   section into the prompt as explicit context.
6. **SSE endpoint:** stream the SDK's events to the browser as structured JSON
   events (assistant text, tool calls, tool results, result). Do not stream raw
   terminal text.
7. **Activity feed:** the Project view consumes the SSE stream and renders a
   structured feed — message blocks, tool-call rows, a final result block.
   Replaces the Phase 1 placeholder. The "Run" button is now live.

## Handoff capture — who writes what

- **The agent writes the narrative.** The launch prompt sent to the SDK must
  end with an explicit instruction: as the final step, create/overwrite
  `.claude/handoff.md` in this repo using the exact section template from
  `02-contracts.md` section 3.
- **The Orchestrator writes the machine state.** When the SDK emits its
  `result` event, the Orchestrator writes `.claude/state.json` from it:
  `status`, `lastSession` (id, endedAt, model, result, costUsd, tokens,
  filesTouched), `updatedAt`. Derive `nextStep` / `blockers` / `openQuestions`
  by parsing the just-written `handoff.md`.
- Do not rely on Claude Code `SessionEnd` hooks — they are unreliable on
  `/exit`. Drive everything from the SDK `result` event.

## Persistence

- Insert a `sessions` row when a run starts (`result: running`); update it on
  completion with cost, tokens, result, `ended_at`.
- Re-upsert the `project_index` row after the run.

## Notification on completion

- Install `node-notifier`. When a run finishes, fire a native macOS
  notification from the **backend** (works when the tab is not focused):
  title = project name, body = run result + one-line next step.
- Insert a `notifications` row with `type: run-complete`.

## Concurrency

- Allow at most one running session per project. Reject a launch for a project
  already `running` with a clear error. Different projects may run in parallel.

## Deliverables

- Live "Run" button and structured activity feed on the Project view.
- Launch + SSE endpoints.
- `.claude/state.json` written on every run; agent-written `.claude/handoff.md`.
- `sessions` rows and notifications recorded.
- README updated: how the Engine works, the resume behavior, the handoff
  contract.

## DO NOT in this phase

- Do not build the Prompt Composer UI (Phase 3) — accept a raw prompt for now.
- Do not build the AI Assistant (Phase 4).
- Do not build the reminder scheduler (Phase 5).

## Acceptance criteria

- Launching a run from the Project view streams a live structured activity feed.
- On completion: `.claude/state.json` updates, `.claude/handoff.md` exists with
  all required sections, a `sessions` row is finalized, a native notification
  fires, and the Global view reflects the new status and next step.
- Launching again resumes the previous session and the prompt includes prior
  handoff context.
- A second launch on an already-running project is rejected cleanly.

When acceptance criteria pass: STOP. Report results and wait for the user to
ask for Phase 3.

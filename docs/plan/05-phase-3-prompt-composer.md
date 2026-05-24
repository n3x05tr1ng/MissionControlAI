# 05 — Phase 3: Prompt Composer

Add the pre-launch UI: shape the prompt and set launch flags before a run.

Read `02-contracts.md` section 8 first. Start in plan mode.

## Scope

A Prompt Composer component on the Project view, sitting in front of the
existing launch endpoint from Phase 2. It produces the launch-flags object from
`02-contracts.md` section 8.

## Controls

- **Prompt textarea** — the raw prompt.
- **Improve prompt** (button) — sends the raw prompt to the Messages API
  (`@anthropic-ai/sdk`) with a meta-prompt that rewrites it into a clearer,
  self-contained Claude Code prompt. Show the improved version; the user can
  accept it (becomes `finalPrompt`) or keep the raw one. This is the first use
  of `@anthropic-ai/sdk` — install it now. Uses `ANTHROPIC_API_KEY` from `.env`.
- **Plan mode** (checkbox) — maps to `permissionMode: 'plan'`. Label it clearly:
  "Plan first, don't edit yet."
- **Use subagents** (checkbox) — maps to the SDK `agents` option. When on, the
  Engine populates a small default set of subagents. Keep the default set
  minimal and defined in one place.
- **Model** (select) — options come from `app.config.json` `models`. Maps to
  the SDK `model` option.
- **Allowed tools** (multi-select) — maps to `allowedTools`. Provide a sensible
  default selection.

## Templates

- A small set of reusable prompt templates stored in
  `templates/prompts/*.md` (e.g. "continue from handoff", "debug failing
  tests", "write tests for recent changes"). The Composer can load one into the
  textarea. "Continue from handoff" pre-fills a prompt that references the
  project's current `.claude/handoff.md`.

## Wiring

- The Composer builds the launch-flags object and posts it to the existing
  Phase 2 launch endpoint. Extend that endpoint to accept the full flags object
  instead of a raw prompt.
- Persist the used `prompt` and `flags` (JSON) on the `sessions` row — these
  columns already exist from `02-contracts.md` section 4.

## Deliverables

- Prompt Composer on the Project view.
- `@anthropic-ai/sdk` installed; "Improve prompt" working.
- Launch endpoint accepts the launch-flags object; flags mapped to SDK options.
- `templates/prompts/` with a few templates.
- README updated: the Composer, what each flag does, how to add a template.

## DO NOT in this phase

- Do not build the AI Assistant chat (Phase 4) — only the single-shot "improve
  prompt" call belongs here.
- Do not build the reminder scheduler (Phase 5).
- Do not invent slash commands that are not real Claude Code / Agent SDK
  features. The flags above map to real SDK options only.

## Acceptance criteria

- "Improve prompt" returns a rewritten prompt the user can accept or reject.
- Toggling plan mode visibly changes run behavior (the run plans without
  editing).
- The model select reflects `app.config.json`.
- Launching a templated prompt works end to end and the `sessions` row records
  the prompt and flags used.

When acceptance criteria pass: STOP. Report results and wait for the user to
ask for Phase 4.

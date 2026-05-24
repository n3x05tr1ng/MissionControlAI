# 06 — Phase 4: AI Assistant

Add a chat assistant that can see the whole portfolio, advise on what to work
on, create reminders, and trigger runs.

Read `02-contracts.md` first. Before writing code, verify the current Messages
API tool-use format from official docs
(https://docs.claude.com/en/api/overview). Cite what you used. Start in
plan mode.

## What this is — and is not

- This is the **Assistant** layer: `@anthropic-ai/sdk` (Messages API) with tool
  use. It reads the portfolio and acts through tools. It is the "manager".
- It is **not** the Engine. It does not run Claude Code inside a repo itself —
  when work needs doing, it calls the `launch_session` tool, which invokes the
  Phase 2 launch endpoint.
- `@anthropic-ai/sdk` is already installed (Phase 3). Model id comes from
  `app.config.json` `assistantModel`. Key from `ANTHROPIC_API_KEY`.

## Scope

1. A chat UI — its own route or a panel available across the app.
2. A backend chat endpoint that runs the Messages API tool-use loop:
   call the model, execute any requested tools, feed results back, repeat until
   a final text answer. Stream the assistant's text to the UI.
3. Tools (defined with input schemas, executed server-side):

| Tool | Does |
|---|---|
| `list_projects` | Returns the registry + each project's current status and next step. |
| `get_project_state` | Full `state.json` + parsed `handoff.md` for one project. |
| `query_timeline` | Recent `sessions` rows, optionally filtered by project. |
| `create_reminder` | Inserts a `reminders` row (`kind: manual`). |
| `launch_session` | Calls the Phase 2 launch endpoint for a project with a prompt + flags. |

4. System prompt: frame the assistant as a portfolio manager for these
   projects — concise, gives one concrete next step, surfaces what is blocked
   or stale, never invents project state (it must use tools to read it).

## Guardrails

- `launch_session` is the only tool with side effects on repos. Require an
  explicit user confirmation in the chat UI before a `launch_session` tool call
  executes — show the project, prompt, and flags, and wait for a click. Read
  tools and `create_reminder` need no confirmation.
- The tool-use loop must bound its iterations (a max step count) to avoid an
  unbounded loop.

## Deliverables

- Chat UI with streamed responses.
- Chat endpoint with the tool-use loop and all five tools.
- `launch_session` confirmation gate.
- README updated: what the Assistant can do, the tool list, the confirmation
  behavior, the env var.

## DO NOT in this phase

- Do not give the Assistant the ability to delete files, delete reminders, or
  modify git history.
- Do not build the reminder scheduler (Phase 5) — `create_reminder` only
  inserts rows; firing them is Phase 5.

## Acceptance criteria

- Asking "what should I work on?" makes the Assistant call `list_projects` /
  `get_project_state` and answer with one concrete recommendation.
- Asking it to remind you about something inserts a `reminders` row visible in
  the Global view panel.
- Asking it to start work on a project shows a confirmation with the prompt and
  flags before anything runs; confirming triggers a real Phase 2 run.
- The Assistant never states project status it did not read via a tool.

When acceptance criteria pass: STOP. Report results and wait for the user to
ask for Phase 5.

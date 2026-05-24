# Workflows

Declarative multi-step automations for Hive. Each YAML file in this folder
becomes a workflow visible in `/workflows`. Files ending in `.example.yaml`
(or `.example.yml`) and files prefixed with `_` are ignored by the loader.

## Schema (v0.1)

```yaml
name: kebab-or-snake-id        # required, becomes the workflow id
description: human-readable    # optional
schedule: "0 22 * * *"         # optional cron (parsed in Wave 5)
on: manual                      # optional: "manual" | "on_session_end" | { stale_days: N }
steps:                          # required, at least 1
  - id: step-id                 # required, unique within the workflow
    run: shell command          # shell step
    in: project                 # optional: "project" | "hive" (default: hive)
    projectId: <project-id>     # required if in: project

  - id: another-step
    agent: claude-code          # agent step — provider id from registry
    projectId: <project-id>     # required
    prompt: |
      Multi-line prompt for the agent.
    flags:                      # optional Partial<LaunchFlags>
      planMode: true
      model: claude-sonnet-4-6
      allowedTools: ["Read", "Edit"]
```

Either `run` or `agent` per step — not both.

## Supported in v0.1

- Parsing and validation (zod + js-yaml).
- DB sync: each YAML upserts a row in `workflows`; YAMLs that disappear are
  marked `enabled = 0` (history of runs is preserved).
- Manual execution via `/workflows/[id]` → "Run now" or
  `POST /api/workflows/[id]/run`.
- Sequential step execution. Shell steps use `sh -c` with a 10-minute timeout;
  stdout/stderr are truncated to 8 KB each in the persisted log.
- Agent steps invoke the registered `AgentProvider` (e.g. `claude-code`) and
  capture the final session result, cost and tokens.
- macOS notification on success or failure.

## Coming next

- Wave 5: `schedule` cron actually firing via `node-cron`.
- Wave 5: `on: on_session_end` and `on: { stale_days: N }` triggers.
- Future: streaming step logs to the UI in real time.

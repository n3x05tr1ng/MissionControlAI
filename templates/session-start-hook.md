# SessionStart hook — auto-load handoff into Claude Code

Hive writes `.claude/handoff.md` at the end of every run. If you also use Claude
Code manually inside a target repo (outside of Hive), this hook makes Claude
Code load the handoff automatically at the start of every session, so you
never lose context.

## How it works

Claude Code supports a `SessionStart` hook that runs a shell command when a
new session begins. We use it to print `handoff.md` into the conversation so
the model sees the previous session's context immediately.

## Install per target repo

Add this to `.claude/settings.json` (or `.claude/settings.local.json`) inside
the target repo:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "test -f .claude/handoff.md && cat .claude/handoff.md || true"
          }
        ]
      }
    ]
  }
}
```

This is documentation only — Hive does not install hooks into your target
repos automatically. You decide which repos opt in.

## Verifying it works

```bash
cd path/to/your/repo
claude
# At the top of the session you should see the handoff content printed.
```

If nothing prints, check:
- The file exists at `.claude/handoff.md` (relative to the repo root).
- `.claude/settings.json` is valid JSON.
- You restarted Claude Code after editing settings.

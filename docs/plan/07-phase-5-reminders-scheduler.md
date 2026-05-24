# 07 — Phase 5: Reminders + Scheduler

Make reminders actually fire, add auto-nudges for stale projects, and complete
the notification system.

Read `02-contracts.md` sections 6 and 7 first. Start in plan mode.

## Scope

1. **Reminder CRUD**
   - Create endpoint (manual reminders) + a create form in the Global view
     Reminders panel.
   - Dismiss endpoint (sets `status: dismissed`).
   - The Phase 4 `create_reminder` tool already inserts rows; reuse the same
     create path.

2. **Scheduler** — `node-cron`, started with the app, polling every minute:
   - **Due reminders:** any `reminders` row with `status: pending` and
     `dueAt <= now` → fire a native notification (`node-notifier`), insert a
     `notifications` row (`type: reminder`), set the reminder `status: fired`.
   - **Auto-nudges:** for each project whose `status` is `idle` or
     `needs-input` and whose last activity is older than
     `app.config.json` `autoNudgeAfterDays` → create a `reminders` row with
     `kind: auto-nudge` (due now) if one is not already pending for that
     project. It then fires through the same due-reminder path.

3. **Notification system completion**
   - One firing function used by both the scheduler and the Phase 2
     run-complete path: fire native notification + insert `notifications` row.
     Refactor Phase 2 to use it if it does not already.
   - The Global view "Recent activity" panel shows the unified history.

## Idempotency

- A reminder fires once: the `pending → fired` transition guards it.
- Auto-nudge creation checks for an existing pending nudge for that project so
  duplicates are not created on every poll.

## Known limitation — document it

The scheduler only runs while `npm run dev` is alive. Reminders do not fire when
the app is closed. State this in the README. Do not build a `launchd` agent or
any always-on background service — out of scope.

## Deliverables

- Reminder create form + dismiss action in the UI.
- `node-cron` scheduler firing due reminders and generating auto-nudges.
- Unified notification firing function.
- README updated: reminders, auto-nudges, the `autoNudgeAfterDays` setting, and
  the scheduler-only-while-running limitation.

## DO NOT in this phase

- Do not build an always-on background daemon or `launchd` integration.
- Do not delete reminders permanently — dismiss only (status change).

## Acceptance criteria

- A manual reminder with a near-future `dueAt` fires a native notification
  within ~1 minute and shows in Recent activity; the row becomes `fired`.
- A project left `idle` past `autoNudgeAfterDays` produces exactly one
  `auto-nudge` reminder, not one per poll.
- Run-complete notifications and reminder notifications share one code path and
  both appear in the unified history.
- README documents the closed-app limitation.

When acceptance criteria pass: STOP. mission-control v1 is complete. Report a
summary of all five phases.

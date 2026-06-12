export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Recover rows stuck in 'running' from a previous process: their handles
    // lived in in-memory Maps, so after a restart they can never finish.
    try {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      const now = new Date().toISOString();
      // Failed tasks go back to backlog with last_error (same convention as
      // tasks/orchestrator.finish on error).
      const tasks = db
        .prepare(
          `UPDATE tasks
           SET status = 'backlog', last_error = 'Interrupted by app restart', completed_at = NULL
           WHERE status = 'running'`,
        )
        .run();
      const sessions = db
        .prepare(
          `UPDATE sessions SET result = 'error', ended_at = ? WHERE result = 'running'`,
        )
        .run(now);
      const runs = db
        .prepare(
          `UPDATE automation_runs
           SET status = 'error', error = 'Interrupted by app restart', ended_at = ?
           WHERE status IN ('pending', 'running')`,
        )
        .run(now);
      if (tasks.changes + sessions.changes + runs.changes > 0) {
        process.stderr.write(
          `[recovery] reset stale running rows: tasks=${tasks.changes} sessions=${sessions.changes} automation_runs=${runs.changes}\n`,
        );
      }
    } catch (err) {
      process.stderr.write(
        `[recovery] failed: ${(err as Error).message}\n`,
      );
    }

    // Seed default agent profiles + the "default" fallback profile,
    // then backfill profile_id on any tasks that predate the migration.
    try {
      const { seedDefaultProfilesIfEmpty } = await import(
        "@/lib/repos/profiles"
      );
      const { backfillTaskProfileIds } = await import("@/lib/repos/tasks");
      const { seeded } = seedDefaultProfilesIfEmpty();
      if (seeded > 0) {
        process.stderr.write(
          `[profiles] seeded ${seeded} default profile(s)\n`,
        );
      }
      const filled = backfillTaskProfileIds("default");
      if (filled > 0) {
        process.stderr.write(
          `[profiles] backfilled profile_id on ${filled} task(s) -> default\n`,
        );
      }
    } catch (err) {
      process.stderr.write(
        `[profiles] seed failed: ${(err as Error).message}\n`,
      );
    }

    // Migrate workflows/*.yaml to recurring tasks (one-time at boot).
    try {
      const { importWorkflowsOnce } = await import(
        "@/lib/workflows/import-once"
      );
      const { imported, skipped, errors } = importWorkflowsOnce();
      process.stderr.write(
        `[workflows-import] imported=${imported} skipped=${skipped} errors=${errors}\n`,
      );
    } catch (err) {
      process.stderr.write(
        `[workflows-import] failed: ${(err as Error).message}\n`,
      );
    }

    // Seed default automation templates (one-time, gated by settings flag).
    try {
      const { seedDefaultAutomationsIfEmpty } = await import(
        "@/lib/automations/templates"
      );
      const { seeded } = seedDefaultAutomationsIfEmpty();
      if (seeded > 0) {
        process.stderr.write(
          `[automations] seeded ${seeded} default template(s)\n`,
        );
      }
    } catch (err) {
      process.stderr.write(
        `[automations] seed failed: ${(err as Error).message}\n`,
      );
    }

    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
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

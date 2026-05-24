import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { SettingRow } from "@/lib/contracts";

let getStmt: Statement | null = null;
let upsertStmt: Statement | null = null;

function getGetStmt(): Statement {
  if (!getStmt) {
    getStmt = getDb().prepare(`SELECT * FROM settings WHERE key = ?`);
  }
  return getStmt;
}

function getUpsertStmt(): Statement {
  if (!upsertStmt) {
    upsertStmt = getDb().prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (@key, @value, @updated_at)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    );
  }
  return upsertStmt;
}

export function getSettingRow(key: string): SettingRow | null {
  const row = getGetStmt().get(key) as SettingRow | undefined;
  return row ?? null;
}

export function upsertSettingRow(key: string, value: string): void {
  getUpsertStmt().run({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
}

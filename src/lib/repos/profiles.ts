import "server-only";

import { getDb } from "@/lib/db";
import type {
  AgentProfile,
  AgentProfileRow,
  PermissionMode,
} from "@/lib/contracts";
import { getDefaultProfileTemplates } from "@/lib/profiles/templates";

const PERMISSION_MODES: readonly PermissionMode[] = [
  "plan",
  "default",
  "acceptEdits",
  "bypassPermissions",
];

export class ProfileInUseError extends Error {
  taskCount: number;
  constructor(taskCount: number) {
    super(`Profile is in use by ${taskCount} task${taskCount === 1 ? "" : "s"}`);
    this.name = "ProfileInUseError";
    this.taskCount = taskCount;
  }
}

function safeParseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function isPermissionMode(s: string): s is PermissionMode {
  return (PERMISSION_MODES as readonly string[]).includes(s);
}

export function rowToProfile(row: AgentProfileRow): AgentProfile {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    systemPrompt: row.system_prompt,
    model: row.model,
    allowedTools: safeParseStringArray(row.allowed_tools),
    mcpServers: safeParseStringArray(row.mcp_servers),
    permissionMode: isPermissionMode(row.permission_mode)
      ? row.permission_mode
      : "default",
    costCapUsd: row.cost_cap_usd,
    timeCapSeconds: row.time_cap_seconds,
    sandbox: row.sandbox === 1,
    isTemplate: row.is_template === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function profileToRow(
  p: Partial<AgentProfile> & { id: string },
): Partial<AgentProfileRow> {
  const row: Partial<AgentProfileRow> = { id: p.id };
  if (p.name !== undefined) row.name = p.name;
  if (p.description !== undefined) row.description = p.description;
  if (p.icon !== undefined) row.icon = p.icon;
  if (p.color !== undefined) row.color = p.color;
  if (p.systemPrompt !== undefined) row.system_prompt = p.systemPrompt;
  if (p.model !== undefined) row.model = p.model;
  if (p.allowedTools !== undefined)
    row.allowed_tools = JSON.stringify(p.allowedTools);
  if (p.mcpServers !== undefined)
    row.mcp_servers = JSON.stringify(p.mcpServers);
  if (p.permissionMode !== undefined) row.permission_mode = p.permissionMode;
  if (p.costCapUsd !== undefined) row.cost_cap_usd = p.costCapUsd;
  if (p.timeCapSeconds !== undefined) row.time_cap_seconds = p.timeCapSeconds;
  if (p.sandbox !== undefined) row.sandbox = p.sandbox ? 1 : 0;
  if (p.isTemplate !== undefined) row.is_template = p.isTemplate ? 1 : 0;
  if (p.createdAt !== undefined) row.created_at = p.createdAt;
  if (p.updatedAt !== undefined) row.updated_at = p.updatedAt;
  return row;
}

export function insertProfile(
  p: Omit<AgentProfile, "createdAt" | "updatedAt">,
): AgentProfile {
  const now = new Date().toISOString();
  const full: AgentProfile = { ...p, createdAt: now, updatedAt: now };
  const row = profileToRow(full) as AgentProfileRow;
  getDb()
    .prepare(
      `INSERT INTO agent_profiles
        (id, name, description, icon, color, system_prompt, model,
         allowed_tools, mcp_servers, permission_mode,
         cost_cap_usd, time_cap_seconds, sandbox, is_template,
         created_at, updated_at)
       VALUES
        (@id, @name, @description, @icon, @color, @system_prompt, @model,
         @allowed_tools, @mcp_servers, @permission_mode,
         @cost_cap_usd, @time_cap_seconds, @sandbox, @is_template,
         @created_at, @updated_at)`,
    )
    .run({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      icon: row.icon,
      color: row.color,
      system_prompt: row.system_prompt ?? null,
      model: row.model,
      allowed_tools: row.allowed_tools,
      mcp_servers: row.mcp_servers,
      permission_mode: row.permission_mode,
      cost_cap_usd: row.cost_cap_usd ?? null,
      time_cap_seconds: row.time_cap_seconds ?? null,
      sandbox: row.sandbox,
      is_template: row.is_template,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  return full;
}

export function getProfile(id: string): AgentProfile | null {
  const row = getDb()
    .prepare(`SELECT * FROM agent_profiles WHERE id = ?`)
    .get(id) as AgentProfileRow | undefined;
  return row ? rowToProfile(row) : null;
}

export interface ListProfilesOpts {
  includeTemplates?: boolean;
}

export function listProfiles(opts: ListProfilesOpts = {}): AgentProfile[] {
  const includeTemplates = opts.includeTemplates ?? true;
  const sql = includeTemplates
    ? `SELECT * FROM agent_profiles ORDER BY is_template ASC, name COLLATE NOCASE ASC`
    : `SELECT * FROM agent_profiles WHERE is_template = 0 ORDER BY name COLLATE NOCASE ASC`;
  const rows = getDb().prepare(sql).all() as AgentProfileRow[];
  return rows.map(rowToProfile);
}

export function updateProfile(
  id: string,
  patch: Partial<AgentProfile>,
): AgentProfile {
  const existing = getProfile(id);
  if (!existing) throw new Error(`Profile not found: ${id}`);
  const next: AgentProfile = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const row = profileToRow(next) as AgentProfileRow;
  getDb()
    .prepare(
      `UPDATE agent_profiles SET
        name = @name,
        description = @description,
        icon = @icon,
        color = @color,
        system_prompt = @system_prompt,
        model = @model,
        allowed_tools = @allowed_tools,
        mcp_servers = @mcp_servers,
        permission_mode = @permission_mode,
        cost_cap_usd = @cost_cap_usd,
        time_cap_seconds = @time_cap_seconds,
        sandbox = @sandbox,
        is_template = @is_template,
        updated_at = @updated_at
       WHERE id = @id`,
    )
    .run({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      icon: row.icon,
      color: row.color,
      system_prompt: row.system_prompt ?? null,
      model: row.model,
      allowed_tools: row.allowed_tools,
      mcp_servers: row.mcp_servers,
      permission_mode: row.permission_mode,
      cost_cap_usd: row.cost_cap_usd ?? null,
      time_cap_seconds: row.time_cap_seconds ?? null,
      sandbox: row.sandbox,
      is_template: row.is_template,
      updated_at: row.updated_at,
    });
  return next;
}

export function deleteProfile(id: string): void {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks WHERE profile_id = ?`,
    )
    .get(id) as { n: number } | undefined;
  const n = row?.n ?? 0;
  if (n > 0) throw new ProfileInUseError(n);
  getDb().prepare(`DELETE FROM agent_profiles WHERE id = ?`).run(id);
}

export function countProfiles(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM agent_profiles`)
    .get() as { n: number } | undefined;
  return row?.n ?? 0;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "profile"
  );
}

export function generateProfileId(name: string): string {
  const base = slugify(name);
  if (!getProfile(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!getProfile(candidate)) return candidate;
  }
  // Astronomical collision — give up with a uuid suffix.
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function duplicateProfile(id: string, newName: string): AgentProfile {
  const src = getProfile(id);
  if (!src) throw new Error(`Profile not found: ${id}`);
  const finalName = newName.trim() || `${src.name} (copy)`;
  const newId = generateProfileId(finalName);
  return insertProfile({
    id: newId,
    name: finalName,
    description: src.description,
    icon: src.icon,
    color: src.color,
    systemPrompt: src.systemPrompt,
    model: src.model,
    allowedTools: [...src.allowedTools],
    mcpServers: [...src.mcpServers],
    permissionMode: src.permissionMode,
    costCapUsd: src.costCapUsd,
    timeCapSeconds: src.timeCapSeconds,
    sandbox: src.sandbox,
    isTemplate: false,
  });
}

export interface SeedResult {
  seeded: number;
}

export function seedDefaultProfilesIfEmpty(): SeedResult {
  if (countProfiles() > 0) return { seeded: 0 };

  const templates = getDefaultProfileTemplates();
  let seeded = 0;
  for (const t of templates) {
    const id = generateProfileId(t.name);
    insertProfile({ id, ...t });
    seeded += 1;
  }

  // Ensure a "default" fallback profile exists, based on Code Reviewer.
  const codeReviewer = templates.find((t) => t.name === "Code Reviewer");
  if (codeReviewer && !getProfile("default")) {
    insertProfile({
      ...codeReviewer,
      id: "default",
      name: "Default",
      description:
        "Fallback profile used when a task has no profile assigned.",
      isTemplate: false,
    });
    seeded += 1;
  }

  return { seeded };
}

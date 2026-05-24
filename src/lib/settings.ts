import "server-only";

import { getSettingRow, upsertSettingRow } from "@/lib/repos/settings";

export type SettingKey =
  | "anthropic_api_key"
  | "engine_default_model"
  | "engine_provider"
  | "assistant_default_model"
  | "auto_nudge_after_days"
  | "mcp_servers_enabled"
  | "models_catalog"
  | "theme"
  | "user_name";

export type EngineProvider = "claude-cli" | "claude-code";

export interface ModelCatalogEntry {
  id: string;
  label: string;
  kind: "engine" | "assistant";
}

const DEFAULT_ENGINE_MODEL = "claude-sonnet-4-6";
const DEFAULT_ASSISTANT_MODEL = "claude-sonnet-4-6";
const DEFAULT_AUTO_NUDGE_DAYS = 3;
const DEFAULT_ENGINE_PROVIDER: EngineProvider = "claude-cli";

const DEFAULT_MODELS_CATALOG: ModelCatalogEntry[] = [
  { id: "claude-opus-4-6", label: "Opus 4.6", kind: "engine" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", kind: "engine" },
  { id: "claude-haiku-4-6", label: "Haiku 4.6", kind: "assistant" },
];

export function getSetting(key: SettingKey): string | null {
  const row = getSettingRow(key);
  return row ? row.value : null;
}

export function setSetting(key: SettingKey, value: string): void {
  upsertSettingRow(key, value);
  invalidateOnSet();
}

export function hasAnthropicKey(): boolean {
  return getSetting("anthropic_api_key") !== null;
}

export function getAnthropicKey(): string | null {
  return getSetting("anthropic_api_key");
}

export function getEngineDefaultModel(): string {
  return getSetting("engine_default_model") ?? DEFAULT_ENGINE_MODEL;
}

export function setEngineDefaultModel(value: string): void {
  setSetting("engine_default_model", value);
}

export function getEngineProvider(): EngineProvider {
  const raw = getSetting("engine_provider");
  if (raw === "claude-cli" || raw === "claude-code") return raw;
  return DEFAULT_ENGINE_PROVIDER;
}

export function setEngineProvider(value: EngineProvider): void {
  setSetting("engine_provider", value);
}

export function getAssistantModel(): string {
  return getSetting("assistant_default_model") ?? DEFAULT_ASSISTANT_MODEL;
}

export function setAssistantModel(value: string): void {
  setSetting("assistant_default_model", value);
}

export function getAutoNudgeAfterDays(): number {
  const raw = getSetting("auto_nudge_after_days");
  if (raw === null) return DEFAULT_AUTO_NUDGE_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_AUTO_NUDGE_DAYS;
  return Math.floor(n);
}

export function setAutoNudgeAfterDays(value: number): void {
  setSetting("auto_nudge_after_days", String(Math.floor(value)));
}

export function getEnabledMcpServers(): string[] {
  const raw = getSetting("mcp_servers_enabled");
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function setEnabledMcpServers(value: string[]): void {
  setSetting("mcp_servers_enabled", JSON.stringify(value));
}

export function getModels(): ModelCatalogEntry[] {
  const raw = getSetting("models_catalog");
  if (raw === null) return DEFAULT_MODELS_CATALOG;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_MODELS_CATALOG;
    const entries: ModelCatalogEntry[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).label === "string" &&
        ((item as Record<string, unknown>).kind === "engine" ||
          (item as Record<string, unknown>).kind === "assistant")
      ) {
        const o = item as { id: string; label: string; kind: "engine" | "assistant" };
        entries.push({ id: o.id, label: o.label, kind: o.kind });
      }
    }
    return entries.length > 0 ? entries : DEFAULT_MODELS_CATALOG;
  } catch {
    return DEFAULT_MODELS_CATALOG;
  }
}

export function setModels(value: ModelCatalogEntry[]): void {
  setSetting("models_catalog", JSON.stringify(value));
}

export function getTheme(): "dark" {
  return "dark";
}

const DEFAULT_USER_NAME = "friend";

export function getUserName(): string {
  const raw = getSetting("user_name");
  if (raw === null) return DEFAULT_USER_NAME;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_USER_NAME;
}

export function setUserName(name: string): void {
  const trimmed = name.trim();
  setSetting("user_name", trimmed.length > 0 ? trimmed : DEFAULT_USER_NAME);
}

// Registry of invalidators so appConfig (and any other cache) can subscribe
// without creating an import cycle.
const invalidators = new Set<() => void>();

export function onSettingsChange(fn: () => void): () => void {
  invalidators.add(fn);
  return () => {
    invalidators.delete(fn);
  };
}

function invalidateOnSet(): void {
  for (const fn of invalidators) {
    try {
      fn();
    } catch {
      // ignore individual subscriber failures
    }
  }
}

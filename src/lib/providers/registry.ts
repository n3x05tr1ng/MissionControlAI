import "server-only";

import type { AgentProvider } from "@/lib/contracts";
import { claudeCli } from "@/lib/providers/claudeCli";
import { claudeCode } from "@/lib/providers/claudeCode";
import { getEngineProvider } from "@/lib/settings";

const providers = new Map<string, AgentProvider>();

export function registerProvider(p: AgentProvider): void {
  providers.set(p.id, p);
}

export function getProvider(id: string): AgentProvider | undefined {
  return providers.get(id);
}

export function listProviders(): AgentProvider[] {
  return Array.from(providers.values());
}

// Self-register built-in providers on first import.
// Order matters: claude-cli (subscription) is the new default and registered
// first; the SDK-based claude-code provider stays as an opt-in fallback.
registerProvider(claudeCli);
registerProvider(claudeCode);

export function getDefaultProvider(): AgentProvider {
  const id = getEngineProvider();
  const p = providers.get(id);
  if (p) return p;
  // Fallback to claude-cli if the setting is invalid or its provider is gone.
  const fallback = providers.get("claude-cli");
  if (fallback) return fallback;
  throw new Error("No default provider registered");
}

import { getAppConfig } from "@/lib/appConfig";
import { getMcpCatalog } from "@/lib/mcp/catalog";
import {
  getAnthropicKey,
  getEnabledMcpServers,
  getEngineProvider,
} from "@/lib/settings";

import { SettingsForm, type SettingsInitial } from "./SettingsForm";

export const dynamic = "force-dynamic";

function maskKey(raw: string): string {
  return `sk-***${raw.slice(-4)}`;
}

export default function SettingsPage() {
  const cfg = getAppConfig();
  const rawKey = getAnthropicKey();
  const enabledMcp = getEnabledMcpServers();
  const mcpCatalog = getMcpCatalog();

  const initial: SettingsInitial = {
    maskedKey: rawKey ? maskKey(rawKey) : null,
    engineProvider: getEngineProvider(),
    engineModel: cfg.defaultEngineModel,
    assistantModel: cfg.assistantModel,
    autoNudgeAfterDays: cfg.autoNudgeAfterDays,
    modelsCatalog: cfg.models,
    enabledMcp,
  };

  return (
    <section className="max-w-3xl">
      <header className="mb-4">
        <h1 className="font-mono text-xs tracking-widest text-hive-amber">
          [ SETTINGS ]
        </h1>
        <p className="mt-1 text-[11px] text-hive-muted">
          Every Hive knob lives here. No config files to edit.
        </p>
      </header>
      <SettingsForm initial={initial} mcpCatalog={mcpCatalog} />
    </section>
  );
}

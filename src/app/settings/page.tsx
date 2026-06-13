import { PageHeader } from "@/components/ui/PageHeader";
import { getAppConfig } from "@/lib/appConfig";
import { getMcpCatalog } from "@/lib/mcp/catalog";
import {
  getAnthropicKey,
  getEnabledMcpServers,
  getEngineProvider,
} from "@/lib/settings";

import { SettingsForm } from "./SettingsForm";
import type { SettingsInitial } from "./types";

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
    <div className="mx-auto max-w-5xl">
      <PageHeader
        overline="Settings"
        title="Settings"
        description="Keys, engine, models, scheduling and MCP — every Hive knob lives here. No config files to edit."
      />
      <SettingsForm initial={initial} mcpCatalog={mcpCatalog} />
    </div>
  );
}

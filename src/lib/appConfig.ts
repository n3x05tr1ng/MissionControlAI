import "server-only";

import type { AppConfig } from "@/lib/contracts";
import {
  getAssistantModel,
  getAutoNudgeAfterDays,
  getEngineDefaultModel,
  getModels,
  onSettingsChange,
} from "@/lib/settings";

let cached: AppConfig | null = null;
let subscribed = false;

function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  onSettingsChange(() => {
    cached = null;
  });
}

export function getAppConfig(): AppConfig {
  ensureSubscribed();
  if (cached) return cached;
  cached = {
    models: getModels(),
    defaultEngineModel: getEngineDefaultModel(),
    assistantModel: getAssistantModel(),
    autoNudgeAfterDays: getAutoNudgeAfterDays(),
  };
  return cached;
}

export function invalidateAppConfigCache(): void {
  cached = null;
}

// Tipos compartidos de la página de Settings.

export type ModelEntry = {
  id: string;
  label: string;
  kind: "engine" | "assistant";
};

export type McpCatalogEntry = {
  id: string;
  label: string;
  description: string;
  configHint: string;
  defaultEnabled: boolean;
};

export type EngineProviderId = "claude-cli" | "claude-code";

export type SettingsInitial = {
  maskedKey: string | null;
  engineProvider: EngineProviderId;
  engineModel: string;
  assistantModel: string;
  autoNudgeAfterDays: number;
  modelsCatalog: ModelEntry[];
  enabledMcp: string[];
};

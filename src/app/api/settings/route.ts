import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { invalidateAppConfigCache } from "@/lib/appConfig";
import {
  getAnthropicKey,
  getAssistantModel,
  getAutoNudgeAfterDays,
  getEnabledMcpServers,
  getEngineDefaultModel,
  getEngineProvider,
  getModels,
  setAssistantModel,
  setAutoNudgeAfterDays,
  setEnabledMcpServers,
  setEngineDefaultModel,
  setEngineProvider,
  setModels,
  setSetting,
  type ModelCatalogEntry,
} from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const modelEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["engine", "assistant"]),
});

const bodySchema = z.discriminatedUnion("key", [
  z.object({ key: z.literal("anthropic_api_key"), value: z.string().min(1) }),
  z.object({ key: z.literal("engine_default_model"), value: z.string().min(1) }),
  z.object({
    key: z.literal("engine_provider"),
    value: z.enum(["claude-cli", "claude-code"]),
  }),
  z.object({ key: z.literal("assistant_default_model"), value: z.string().min(1) }),
  z.object({
    key: z.literal("auto_nudge_after_days"),
    value: z.number().int().min(1).max(90),
  }),
  z.object({
    key: z.literal("mcp_servers_enabled"),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.literal("models_catalog"),
    value: z.array(modelEntrySchema).min(1),
  }),
  z.object({ key: z.literal("user_name"), value: z.string().min(1).max(80) }),
]);

function maskKey(value: string): string {
  const last4 = value.slice(-4);
  return `sk-***${last4}`;
}

export async function GET(): Promise<Response> {
  try {
    const rawKey = getAnthropicKey();
    return Response.json({
      anthropic_api_key: rawKey ? maskKey(rawKey) : null,
      engine_default_model: getEngineDefaultModel(),
      engine_provider: getEngineProvider(),
      assistant_default_model: getAssistantModel(),
      auto_nudge_after_days: getAutoNudgeAfterDays(),
      mcp_servers_enabled: getEnabledMcpServers(),
      models_catalog: getModels(),
      theme: "dark" as const,
    });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return apiError(
        `Invalid body or unknown key: ${parsed.error.message}`,
        400,
      );
    }

    const data = parsed.data;
    switch (data.key) {
      case "anthropic_api_key":
        setSetting("anthropic_api_key", data.value);
        break;
      case "engine_default_model":
        setEngineDefaultModel(data.value);
        break;
      case "engine_provider":
        setEngineProvider(data.value);
        break;
      case "assistant_default_model":
        setAssistantModel(data.value);
        break;
      case "auto_nudge_after_days":
        setAutoNudgeAfterDays(data.value);
        break;
      case "mcp_servers_enabled":
        setEnabledMcpServers(data.value);
        break;
      case "models_catalog":
        setModels(data.value as ModelCatalogEntry[]);
        break;
      case "user_name":
        setSetting("user_name", data.value);
        break;
    }
    invalidateAppConfigCache();
    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { getEngineDefaultModel } from "@/lib/settings";
import {
  generateProfileId,
  insertProfile,
  listProfiles,
} from "@/lib/repos/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const profileInputSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().nullable().optional(),
  icon: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  systemPrompt: z.string().nullable().optional(),
  model: z.string().min(1).optional(),
  allowedTools: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
  permissionMode: z
    .enum(["plan", "default", "acceptEdits", "bypassPermissions"])
    .optional(),
  costCapUsd: z.number().nullable().optional(),
  timeCapSeconds: z.number().int().nullable().optional(),
  sandbox: z.boolean().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const includeTemplates =
      url.searchParams.get("includeTemplates") !== "false";
    const profiles = listProfiles({ includeTemplates });
    return Response.json(profiles);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = profileInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  try {
    const input = parsed.data;
    const id = generateProfileId(input.name);
    const profile = insertProfile({
      id,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? "hexagon",
      color: input.color ?? "#FFB000",
      systemPrompt: input.systemPrompt ?? null,
      model: input.model ?? getEngineDefaultModel(),
      allowedTools: input.allowedTools ?? [],
      mcpServers: input.mcpServers ?? [],
      permissionMode: input.permissionMode ?? "default",
      costCapUsd: input.costCapUsd ?? null,
      timeCapSeconds: input.timeCapSeconds ?? null,
      sandbox: input.sandbox ?? false,
      isTemplate: false,
    });
    return Response.json(profile);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

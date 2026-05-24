import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import {
  ProfileInUseError,
  deleteProfile,
  getProfile,
  updateProfile,
} from "@/lib/repos/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
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
  isTemplate: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const profile = getProfile(id);
    if (!profile) return apiError("Profile not found", 404);
    return Response.json(profile);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!getProfile(id)) return apiError("Profile not found", 404);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }
    const updated = updateProfile(id, parsed.data);
    return Response.json(updated);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!getProfile(id)) return apiError("Profile not found", 404);
    try {
      deleteProfile(id);
    } catch (err) {
      if (err instanceof ProfileInUseError) {
        return Response.json(
          { error: `in use by ${err.taskCount} task${err.taskCount === 1 ? "" : "s"}` },
          { status: 409 },
        );
      }
      throw err;
    }
    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

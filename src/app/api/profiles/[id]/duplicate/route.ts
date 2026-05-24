import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { duplicateProfile, getProfile } from "@/lib/repos/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    newName: z.string().min(1).optional(),
  })
  .optional();

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const src = getProfile(id);
    if (!src) return apiError("Profile not found", 404);

    let body: unknown = undefined;
    try {
      const text = await req.text();
      if (text.length > 0) body = JSON.parse(text);
    } catch {
      return apiError("Invalid JSON body", 400);
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }
    const newName = parsed.data?.newName?.trim() || `${src.name} (copy)`;
    const created = duplicateProfile(id, newName);
    return Response.json(created);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

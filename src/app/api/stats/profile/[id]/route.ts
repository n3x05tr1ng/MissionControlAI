import "server-only";

import { apiError } from "@/lib/api/errors";
import { getProfile } from "@/lib/repos/profiles";
import { usageByProfile } from "@/lib/stats/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const profile = getProfile(id);
    if (!profile) return apiError("Profile not found", 404);
    return Response.json(usageByProfile(id));
  } catch (err) {
    return apiError((err as Error).message);
  }
}

import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { updateReminderStatus } from "@/lib/repos/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchBodySchema = z.object({
  status: z.enum(["dismissed", "fired"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const raw = (await req.json()) as unknown;
    const parsed = patchBodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(`Invalid body: ${parsed.error.message}`, 400);
    }
    updateReminderStatus(id, parsed.data.status);
    return Response.json({ ok: true });
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
    updateReminderStatus(id, "dismissed");
    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

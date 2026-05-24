import "server-only";

import { apiError } from "@/lib/api/errors";
import { recentNotifications } from "@/lib/repos/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(recentNotifications(20));
  } catch (err) {
    return apiError((err as Error).message);
  }
}

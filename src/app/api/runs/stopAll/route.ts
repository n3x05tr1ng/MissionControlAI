import "server-only";

import { apiError } from "@/lib/api/errors";
import { stopAllRuns } from "@/lib/engine/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    const n = stopAllRuns();
    return Response.json({ stopped: n });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

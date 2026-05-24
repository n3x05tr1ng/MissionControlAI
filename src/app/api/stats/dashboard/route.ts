import "server-only";

import { apiError } from "@/lib/api/errors";
import { kpis, runsByProject, runsLastNDays } from "@/lib/stats/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({
      kpis: kpis(),
      runs14d: runsLastNDays(14),
      runsByProject: runsByProject(),
    });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

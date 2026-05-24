import "server-only";

import { apiError } from "@/lib/api/errors";
import { listProviders } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const providers = listProviders().map((p) => ({
      id: p.id,
      label: p.label,
    }));
    return Response.json(providers);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

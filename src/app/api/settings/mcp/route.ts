import "server-only";

import { apiError } from "@/lib/api/errors";
import { getMcpCatalog } from "@/lib/mcp/catalog";
import { getEnabledMcpServers } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const catalog = getMcpCatalog();
    const enabled = getEnabledMcpServers();
    return Response.json({ catalog, enabled });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

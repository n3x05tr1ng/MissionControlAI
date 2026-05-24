import "server-only";

import { apiError } from "@/lib/api/errors";
import { markOnboardingDone } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    markOnboardingDone();
    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

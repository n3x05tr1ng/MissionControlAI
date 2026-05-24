import "server-only";

import { exec } from "node:child_process";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execAsync = promisify(exec);

export async function GET(): Promise<Response> {
  try {
    const { stdout } = await execAsync("claude --version", {
      timeout: 5000,
    });
    const version = stdout.trim();
    return Response.json({ ok: true, version });
  } catch (err) {
    return Response.json({
      ok: false,
      error: (err as Error).message,
    });
  }
}

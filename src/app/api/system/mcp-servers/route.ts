import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildEnvWithClaudeDir, resolveClaudeCli } from "@/lib/providers/claudeCliPath";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

export interface McpServerStatus {
  // The id matches the `mcp__<id>__*` prefix the CLI exposes — the catalog
  // and agent profiles store the same string so the UI can correlate them.
  id: string;
  label: string;
  status: "connected" | "needs_auth" | "error" | "unknown";
  raw: string;
}

// `claude mcp list` lines look like:
//   "claude.ai Notion: https://mcp.notion.com/mcp - ✓ Connected"
//   "cli-microsoft365: /path/to/server  - ✓ Connected"
//   "claude.ai Google Drive: https://... - ! Needs authentication"
// The id we expose mirrors how Claude Code names the tool prefix:
// space-and-dot separators collapse to underscores.
const LIST_LINE_RE = /^([^:]+):\s+(.+)$/;

function labelToId(label: string): string {
  return label.trim().replace(/[.\s]+/g, "_");
}

function classifyStatus(rest: string): McpServerStatus["status"] {
  const lower = rest.toLowerCase();
  if (lower.includes("connected")) return "connected";
  if (lower.includes("needs authentication") || lower.includes("not authenticated")) return "needs_auth";
  if (lower.includes("error") || lower.includes("failed")) return "error";
  return "unknown";
}

export async function GET(): Promise<Response> {
  try {
    // `claude mcp list` probes server health which can be slow if a remote
    // MCP is down. Bound it so the API never hangs the UI.
    const { stdout } = await execFileAsync(resolveClaudeCli(), ["mcp", "list"], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      env: buildEnvWithClaudeDir(),
    });
    const servers: McpServerStatus[] = [];
    for (const raw of stdout.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      // Skip the "Checking MCP server health…" header and similar status noise.
      if (!line.includes(":")) continue;
      const m = line.match(LIST_LINE_RE);
      if (!m) continue;
      const label = m[1].trim();
      const rest = m[2].trim();
      if (!label || label.toLowerCase().startsWith("checking")) continue;
      servers.push({
        id: labelToId(label),
        label,
        status: classifyStatus(rest),
        raw: line,
      });
    }
    return Response.json({ ok: true, servers });
  } catch (err) {
    return Response.json({
      ok: false,
      error: (err as Error).message,
      servers: [] as McpServerStatus[],
    });
  }
}

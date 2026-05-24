import "server-only";

// Minimal helpers for handling raw PTY output from the `claude` CLI.

// Strips common ANSI escape sequences (CSI color/format and OSC titles).
export function stripAnsi(s: string): string {
  // CSI sequences: ESC [ ... letter
  // OSC sequences: ESC ] ... BEL or ESC \
  // Plus a handful of single-char escapes (ESC + non-CSI byte).
  return s
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[=>]/g, "")
    .replace(/\r/g, "");
}

export function splitLines(s: string): string[] {
  const parts = s.split(/\r?\n/);
  while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

export interface ParsedToolLine {
  kind: "tool.use" | "tool.result" | null;
  name?: string;
  input?: unknown;
}

// Claude Code prints tool invocations as `● ToolName(argument)` and tool
// results as `  ⎿  ...result...`. We parse conservatively; on any doubt we
// return { kind: null } so the caller treats the line as a plain message.
export function parseToolLine(line: string): ParsedToolLine {
  const trimmed = line.trim();
  if (trimmed.length === 0) return { kind: null };

  // Tool use marker.
  if (trimmed.startsWith("●") || trimmed.startsWith("●")) {
    const rest = trimmed.replace(/^[●●]\s*/, "");
    const m = rest.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*$/);
    if (m) {
      return { kind: "tool.use", name: m[1], input: m[2] };
    }
    const m2 = rest.match(/^([A-Za-z][A-Za-z0-9_]*)\b/);
    if (m2) {
      return { kind: "tool.use", name: m2[1], input: rest.slice(m2[1].length).trim() };
    }
    return { kind: null };
  }

  // Tool result marker (Claude uses U+23BF / U+23BE-ish; the visible char is ⎿).
  if (trimmed.startsWith("⎿") || trimmed.startsWith("⎿")) {
    const rest = trimmed.replace(/^[⎿⎿]\s*/, "");
    return { kind: "tool.result", name: "tool", input: rest };
  }

  return { kind: null };
}

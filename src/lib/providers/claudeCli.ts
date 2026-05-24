import "server-only";

import { execFileSync, spawn as childSpawn } from "node:child_process";

import { buildEnvWithClaudeDir, resolveClaudeCli } from "@/lib/providers/claudeCliPath";

import type {
  AgentEvent,
  AgentProvider,
  AgentRunOptions,
} from "@/lib/contracts";
import {
  parseToolLine,
  splitLines,
  stripAnsi,
} from "@/lib/providers/ptyOutput";

// ---------------------------------------------------------------------------
// Best-effort token extraction. The `claude --print` CLI in 2.1.x sometimes
// emits a usage summary line at the end (varies by version + permission mode).
// We sweep the captured stdout for known shapes. If nothing matches we leave
// tokens at zero; the UI renders "—" for that.
// ---------------------------------------------------------------------------
const INPUT_TOKENS_RE = /(\d[\d,]*)\s*(?:input|prompt)\s*tokens/i;
const OUTPUT_TOKENS_RE = /(\d[\d,]*)\s*(?:output|completion)\s*tokens/i;
const TOTAL_TOKENS_RE = /total\s*tokens?:?\s*(\d[\d,]*)/i;
const TOKENS_USED_RE = /tokens?\s*used\s*:?\s*(\d[\d,]*)/i;

function toInt(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function extractTokens(buf: string): { input: number; output: number } {
  const inputMatch = buf.match(INPUT_TOKENS_RE);
  const outputMatch = buf.match(OUTPUT_TOKENS_RE);
  if (inputMatch || outputMatch) {
    return {
      input: toInt(inputMatch?.[1]),
      output: toInt(outputMatch?.[1]),
    };
  }
  const totalMatch = buf.match(TOTAL_TOKENS_RE) ?? buf.match(TOKENS_USED_RE);
  if (totalMatch) {
    // Lump the whole total into 'input' for honesty — we don't know the split.
    return { input: toInt(totalMatch[1]), output: 0 };
  }
  return { input: 0, output: 0 };
}

// ---------------------------------------------------------------------------
// CLI capability probe (cached). We run `claude --help` once at module load
// and look for the flags we care about so we degrade gracefully if the CLI
// changes its surface.
// ---------------------------------------------------------------------------

interface CliCaps {
  hasModel: boolean;
  hasPermissionMode: boolean;
  hasAllowedTools: boolean;
  hasPrint: boolean;
}

let cachedCaps: CliCaps | null = null;

function probeCaps(): CliCaps {
  if (cachedCaps) return cachedCaps;
  let help = "";
  try {
    help = execFileSync(resolveClaudeCli(), ["--help"], {
      encoding: "utf8",
      timeout: 5000,
      env: buildEnvWithClaudeDir(),
    });
  } catch (err) {
    process.stderr.write(
      `[claudeCli] could not probe 'claude --help': ${(err as Error).message}\n`,
    );
    cachedCaps = {
      hasModel: true,
      hasPermissionMode: true,
      hasAllowedTools: true,
      hasPrint: true,
    };
    return cachedCaps;
  }
  cachedCaps = {
    hasModel: /--model\b/.test(help),
    hasPermissionMode: /--permission-mode\b/.test(help),
    hasAllowedTools: /--allowed-tools\b|--allowedTools\b/.test(help),
    hasPrint: /(^|\s)-p(,|\s|\b)|--print\b/.test(help),
  };
  return cachedCaps;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface PtyHandle {
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): {
    dispose(): void;
  };
  kill(signal?: string): void;
  write(data: string): void;
}

// Adapter: wrap child_process.spawn output streams to look like the PtyHandle
// shape the run loop expects. We use plain child_process (not node-pty) because
// node-pty fails with `posix_spawnp failed.` inside Next.js worker contexts on
// macOS arm64 — even for trivial binaries. claude --print is non-interactive
// so a regular pipe works fine.
function spawnAsPty(
  cmd: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; stdin?: string },
): PtyHandle {
  const child = childSpawn(cmd, args, {
    cwd: opts.cwd,
    env: opts.env,
    stdio: [opts.stdin !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
  });
  if (opts.stdin !== undefined && child.stdin) {
    child.stdin.write(opts.stdin);
    child.stdin.end();
  }
  const dataCbs: Array<(s: string) => void> = [];
  const exitCbs: Array<(e: { exitCode: number; signal?: number }) => void> = [];
  child.stdout?.on("data", (b: Buffer) => {
    const s = b.toString("utf8");
    for (const cb of dataCbs) cb(s);
  });
  child.stderr?.on("data", (b: Buffer) => {
    const s = b.toString("utf8");
    for (const cb of dataCbs) cb(s);
  });
  child.on("exit", (code, signal) => {
    const e = { exitCode: code ?? (signal ? 128 : 0), signal: signal ? 1 : undefined };
    for (const cb of exitCbs) cb(e);
  });
  child.on("error", (err) => {
    for (const cb of dataCbs) cb(`\n[spawn error] ${err.message}\n`);
    const e = { exitCode: 1 };
    for (const cb of exitCbs) cb(e);
  });
  return {
    onData(cb) {
      dataCbs.push(cb);
      return { dispose() { const i = dataCbs.indexOf(cb); if (i >= 0) dataCbs.splice(i, 1); } };
    },
    onExit(cb) {
      exitCbs.push(cb);
      return { dispose() { const i = exitCbs.indexOf(cb); if (i >= 0) exitCbs.splice(i, 1); } };
    },
    kill(signal) {
      try { child.kill((signal as NodeJS.Signals) ?? "SIGTERM"); } catch { /* ignore */ }
    },
    write(data) {
      // No stdin in --print mode; this is a no-op so the interface still satisfies.
      void data;
    },
  };
}

// Expand a profile's `mcpServers` ids into CLI tool patterns. The Claude CLI
// exposes every MCP tool as `mcp__<server-id>__<tool-name>`, and supports a
// trailing wildcard in --allowed-tools entries, so one pattern per server
// authorizes the agent to call any tool that server offers. MCPs configured at
// user scope (in ~/.claude.json or via OAuth on the user's claude.ai account)
// are auto-loaded by the CLI — we don't need --mcp-config to make them
// reachable, only --allowed-tools to make them callable.
function buildMcpToolPatterns(serverIds: string[]): string[] {
  return serverIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => `mcp__${id}__*`);
}

export const claudeCli: AgentProvider = {
  id: "claude-cli",
  label: "Claude CLI (subscription)",

  async *run(opts: AgentRunOptions): AsyncIterable<AgentEvent> {
    const sessionId = crypto.randomUUID();
    yield { type: "session.start", sessionId, ts: nowIso() };

    const caps = probeCaps();
    const profile = opts.profile;
    const flags = opts.flags;

    const args: string[] = [];

    if (caps.hasPrint) args.push("--print");

    if (caps.hasModel) {
      const model = profile?.model ?? flags.model;
      if (model && model.length > 0) {
        args.push("--model", model);
      }
    } else {
      process.stderr.write("[claudeCli] CLI does not advertise --model; skipping\n");
    }

    if (caps.hasPermissionMode) {
      const mode = profile?.permissionMode ?? (flags.planMode ? "plan" : "default");
      args.push("--permission-mode", mode);
    } else {
      process.stderr.write(
        "[claudeCli] CLI does not advertise --permission-mode; skipping\n",
      );
    }

    if (caps.hasAllowedTools) {
      const baseAllowed =
        profile?.allowedTools && profile.allowedTools.length > 0
          ? profile.allowedTools
          : flags.allowedTools && flags.allowedTools.length > 0
            ? flags.allowedTools
            : [];
      const mcpPatterns = buildMcpToolPatterns(profile?.mcpServers ?? []);
      // De-dupe while preserving order so an explicit allow + the wildcard for
      // the same server don't double up in the CLI args.
      const merged = Array.from(new Set([...baseAllowed, ...mcpPatterns]));
      if (merged.length > 0) {
        args.push("--allowed-tools", merged.join(","));
      }
    }

    // We pass the prompt via STDIN, not as a positional arg. Reason:
    // --allowed-tools is variadic in the CLI and would otherwise swallow
    // the trailing prompt. Stdin also handles long/multiline prompts safely.

    interface ExitInfo {
      exitCode: number;
      signal?: number;
    }
    const state: {
      aborted: boolean;
      exited: boolean;
      exitInfo: ExitInfo | null;
    } = { aborted: false, exited: false, exitInfo: null };

    let proc: PtyHandle;
    try {
      proc = spawnAsPty(resolveClaudeCli(), args, {
        cwd: opts.projectPath,
        env: buildEnvWithClaudeDir(),
        stdin: flags.finalPrompt,
      });
    } catch (err) {
      yield {
        type: "error",
        message: `Failed to spawn 'claude' CLI: ${(err as Error).message}`,
        ts: nowIso(),
      };
      yield {
        type: "session.end",
        sessionId,
        result: "error",
        // Cost/tokens are unavailable from PTY output. See note in #1 / runner.ts.
        costUsd: 0,
        tokens: { input: 0, output: 0 },
        filesTouched: [],
        ts: nowIso(),
      };
      return;
    }

    // Bridge external abort signal.
    const externalSignal = opts.signal;
    const onAbort = (): void => {
      state.aborted = true;
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    };
    if (externalSignal) {
      if (externalSignal.aborted) onAbort();
      else externalSignal.addEventListener("abort", onAbort, { once: true });
    }

    // Buffer raw bytes -> line events through an async queue so we can `yield`
    // them ordered with respect to the exit event.
    const queue: AgentEvent[] = [];
    let waiter: (() => void) | null = null;
    const wake = (): void => {
      if (waiter) {
        const w = waiter;
        waiter = null;
        w();
      }
    };

    let lineBuf = "";
    // Full cleaned stdout, capped to avoid runaway memory on long sessions.
    // Token sweeps only care about the tail (summary line).
    let fullBuf = "";
    const FULL_BUF_CAP = 64 * 1024;

    const dataSub = proc.onData((data: string) => {
      const cleaned = stripAnsi(data);
      lineBuf += cleaned;
      fullBuf += cleaned;
      if (fullBuf.length > FULL_BUF_CAP) {
        fullBuf = fullBuf.slice(fullBuf.length - FULL_BUF_CAP);
      }
      // Emit each complete newline-terminated line; keep the trailing partial.
      let idx = lineBuf.indexOf("\n");
      while (idx !== -1) {
        const line = lineBuf.slice(0, idx);
        lineBuf = lineBuf.slice(idx + 1);
        if (line.trim().length > 0) {
          const parsed = parseToolLine(line);
          if (parsed.kind === "tool.use" && parsed.name) {
            queue.push({
              type: "tool.use",
              name: parsed.name,
              input: parsed.input,
              ts: nowIso(),
            });
          } else if (parsed.kind === "tool.result" && parsed.name) {
            queue.push({
              type: "tool.result",
              name: parsed.name,
              output: parsed.input,
              ts: nowIso(),
            });
          } else {
            queue.push({
              type: "message",
              role: "assistant",
              text: line,
              ts: nowIso(),
            });
          }
        }
        idx = lineBuf.indexOf("\n");
      }
      wake();
    });

    const exitSub = proc.onExit((e) => {
      state.exited = true;
      state.exitInfo = e;
      // Flush any trailing partial line that never got a newline.
      if (lineBuf.trim().length > 0) {
        const remaining = splitLines(lineBuf);
        for (const line of remaining) {
          if (line.trim().length === 0) continue;
          queue.push({
            type: "message",
            role: "assistant",
            text: line,
            ts: nowIso(),
          });
        }
        lineBuf = "";
      }
      wake();
    });

    try {
      while (!state.exited || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            waiter = resolve;
          });
          continue;
        }
        const ev = queue.shift();
        if (ev) yield ev;
        if (state.aborted && queue.length === 0 && !state.exited) {
          // Give the process a moment to flush after SIGTERM but don't hang.
          break;
        }
      }

      if (state.aborted) {
        yield {
          type: "error",
          message: "Stopped by user",
          ts: nowIso(),
        };
      }

      const exitCode = state.exitInfo
        ? state.exitInfo.exitCode
        : state.aborted
          ? 130
          : 0;
      const result: "success" | "error" =
        state.aborted || exitCode !== 0 ? "error" : "success";
      // Subscription mode: no dollar cost. Tokens are best-effort from stdout.
      const tokens = extractTokens(fullBuf);
      yield {
        type: "session.end",
        sessionId,
        result,
        costUsd: 0,
        tokens,
        filesTouched: [],
        ts: nowIso(),
      };
    } catch (err) {
      yield {
        type: "error",
        message: (err as Error).message,
        ts: nowIso(),
      };
      const tokens = extractTokens(fullBuf);
      yield {
        type: "session.end",
        sessionId,
        result: "error",
        costUsd: 0,
        tokens,
        filesTouched: [],
        ts: nowIso(),
      };
    } finally {
      try {
        dataSub.dispose();
      } catch {
        // ignore
      }
      try {
        exitSub.dispose();
      } catch {
        // ignore
      }
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onAbort);
      }
    }
  },
};

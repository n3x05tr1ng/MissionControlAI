import "server-only";

import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  Options,
  PermissionMode,
  SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";

import type {
  AgentEvent,
  AgentProvider,
  AgentRunOptions,
} from "@/lib/contracts";
import { getAnthropicKey } from "@/lib/settings";

// Fixed instruction appended to every prompt so the agent always closes the
// loop by writing `.claude/handoff.md` and updating `.claude/state.json`.
// The exact heading set mirrors docs/plan/02-contracts.md so handoffParser.ts
// can pick the sections up reliably.
const HANDOFF_TAIL = `

---

IMPORTANT: As your FINAL action before responding to the user, you MUST:

1. Write \`.claude/handoff.md\` in the current working directory with EXACTLY these six sections, in this order, using level-2 markdown headings:

\`\`\`
# Handoff — <project name> — <ISO date>

## Done this session
<bulleted list of what you did>

## Next step
<one-line description of the next logical action>

## Blockers
<bulleted list, or "None">

## Open questions
<bulleted list, or "None">

## Files touched
<bulleted list of relative paths, or "None">

## Context for next run
<short paragraph with anything the next run needs to remember>
\`\`\`

2. Update \`.claude/state.json\` so its top-level \`status\` reflects the project's current state (one of: "idle", "running", "needs-input", "blocked", "done"), and its \`nextStep\` field matches the "Next step" section above. Create the file if missing.

Create the \`.claude\` directory if it does not exist. Do not skip this step.
`;

// Local narrowing helpers for SDK content blocks. The SDK re-exports
// BetaMessage from @anthropic-ai/sdk; we only need the discriminated `type`
// field plus a handful of payload fields, so we type-guard at the boundary
// instead of pulling the full BetaContentBlock union into our code.
type SdkTextBlock = { type: "text"; text: string };
type SdkToolUseBlock = {
  type: "tool_use";
  id?: string;
  name: string;
  input: unknown;
};

function isTextBlock(b: unknown): b is SdkTextBlock {
  return (
    typeof b === "object" &&
    b !== null &&
    (b as { type?: unknown }).type === "text" &&
    typeof (b as { text?: unknown }).text === "string"
  );
}

function isToolUseBlock(b: unknown): b is SdkToolUseBlock {
  return (
    typeof b === "object" &&
    b !== null &&
    (b as { type?: unknown }).type === "tool_use" &&
    typeof (b as { name?: unknown }).name === "string"
  );
}

// SDKUserMessage carries tool_result blocks inside its `message.content`.
type SdkToolResultBlock = {
  type: "tool_result";
  tool_use_id?: string;
  content?: unknown;
};

function isToolResultBlock(b: unknown): b is SdkToolResultBlock {
  return (
    typeof b === "object" &&
    b !== null &&
    (b as { type?: unknown }).type === "tool_result"
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function extractTextFromAssistantContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (isTextBlock(block)) parts.push(block.text);
  }
  return parts.join("\n").trim();
}

function extractToolUses(content: unknown): SdkToolUseBlock[] {
  if (!Array.isArray(content)) return [];
  return content.filter(isToolUseBlock);
}

function extractToolResults(content: unknown): SdkToolResultBlock[] {
  if (!Array.isArray(content)) return [];
  return content.filter(isToolResultBlock);
}

export const claudeCode: AgentProvider = {
  id: "claude-code",
  label: "Claude Code",

  async *run(opts: AgentRunOptions): AsyncIterable<AgentEvent> {
    const apiKey = getAnthropicKey();
    if (!apiKey) {
      yield {
        type: "error",
        message:
          "ANTHROPIC_API_KEY not configured. Open /settings to add it.",
        ts: nowIso(),
      };
      return;
    }

    const runSessionId = crypto.randomUUID();
    yield {
      type: "session.start",
      sessionId: runSessionId,
      ts: nowIso(),
    };

    // Resolve effective settings: profile overrides flags where set.
    const profile = opts.profile;
    const permissionMode: PermissionMode = profile
      ? profile.permissionMode
      : opts.flags.planMode
        ? "plan"
        : "default";

    const effectiveModel = profile?.model ?? opts.flags.model;
    const effectiveAllowedTools =
      profile?.allowedTools && profile.allowedTools.length > 0
        ? profile.allowedTools
        : opts.flags.allowedTools && opts.flags.allowedTools.length > 0
          ? opts.flags.allowedTools
          : undefined;

    // STUB (v0.3): MCP runtime wiring is deferred to v0.4. The profile's
    // `mcpServers` list is persisted and surfaced in the UI, but we do NOT
    // construct McpServerConfig entries here. A future revision will read
    // the user's local Claude Code MCP settings and translate ids to live
    // server configs; for now we pass an empty record so the SDK behaves
    // exactly as before.
    const mcpServers: Options["mcpServers"] = {};

    // Caps via AbortController: cancel the in-flight query when either
    // (a) accumulated cost from incremental `result` events exceeds the cap,
    // or (b) elapsed wall time exceeds the cap.
    // Also aborts when an external `opts.signal` (user STOP) fires.
    const ac = new AbortController();
    const startTimeMs = Date.now();
    let capExceededReason: string | null = null;
    let timeCapTimer: NodeJS.Timeout | null = null;
    if (
      profile?.timeCapSeconds &&
      Number.isFinite(profile.timeCapSeconds) &&
      profile.timeCapSeconds > 0
    ) {
      timeCapTimer = setTimeout(() => {
        capExceededReason = `time cap exceeded (${profile.timeCapSeconds}s)`;
        ac.abort();
      }, profile.timeCapSeconds * 1000);
    }

    // Chain the external user-stop signal into our internal AbortController.
    let userStopped = false;
    const externalSignal = opts.signal;
    const onExternalAbort = (): void => {
      userStopped = true;
      ac.abort();
    };
    if (externalSignal) {
      if (externalSignal.aborted) {
        onExternalAbort();
      } else {
        externalSignal.addEventListener("abort", onExternalAbort, {
          once: true,
        });
      }
    }

    const sdkOptions: Options = {
      cwd: opts.projectPath,
      model: effectiveModel,
      permissionMode,
      // Forward the API key to the spawned subprocess explicitly. The SDK
      // replaces the subprocess env entirely when `env` is set, so we must
      // also spread process.env to preserve PATH/HOME etc.
      env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
      mcpServers,
      abortController: ac,
    };

    if (effectiveAllowedTools) {
      sdkOptions.allowedTools = effectiveAllowedTools;
    }

    if (profile?.systemPrompt && profile.systemPrompt.trim().length > 0) {
      sdkOptions.systemPrompt = profile.systemPrompt;
    }

    // Belt-and-suspenders: also set the key in our own process env so any
    // fallback resolution finds it.
    process.env.ANTHROPIC_API_KEY = apiKey;

    const finalPrompt = `${opts.flags.finalPrompt}${HANDOFF_TAIL}`;

    let tokensInput = 0;
    let tokensOutput = 0;
    let costUsd = 0;
    const filesTouched = new Set<string>();
    let endedNormally = false;

    try {
      const iter = query({ prompt: finalPrompt, options: sdkOptions });

      for await (const raw of iter) {
        if (userStopped) break;
        const msg = raw as SDKMessage;

        if (msg.type === "assistant") {
          const text = extractTextFromAssistantContent(msg.message?.content);
          if (text.length > 0) {
            yield {
              type: "message",
              role: "assistant",
              text,
              ts: nowIso(),
            };
          }
          for (const tu of extractToolUses(msg.message?.content)) {
            yield {
              type: "tool.use",
              name: tu.name,
              input: tu.input,
              ts: nowIso(),
            };
            // Best-effort: capture file paths touched by built-in editor tools.
            if (
              (tu.name === "Edit" ||
                tu.name === "Write" ||
                tu.name === "NotebookEdit") &&
              tu.input &&
              typeof tu.input === "object"
            ) {
              const fp = (tu.input as { file_path?: unknown }).file_path;
              if (typeof fp === "string" && fp.length > 0) {
                filesTouched.add(fp);
              }
            }
          }
        } else if (msg.type === "user") {
          for (const tr of extractToolResults(msg.message?.content)) {
            yield {
              type: "tool.result",
              name: tr.tool_use_id ?? "tool",
              output: tr.content,
              ts: nowIso(),
            };
          }
        } else if (msg.type === "result") {
          tokensInput =
            (msg.usage?.input_tokens ?? 0) +
            (msg.usage?.cache_read_input_tokens ?? 0) +
            (msg.usage?.cache_creation_input_tokens ?? 0);
          tokensOutput = msg.usage?.output_tokens ?? 0;
          costUsd = msg.total_cost_usd ?? 0;

          // Cost cap check on each incremental result message.
          if (
            !capExceededReason &&
            profile?.costCapUsd &&
            Number.isFinite(profile.costCapUsd) &&
            profile.costCapUsd > 0 &&
            costUsd > profile.costCapUsd
          ) {
            capExceededReason = `cost cap exceeded ($${costUsd.toFixed(4)} > $${profile.costCapUsd})`;
            ac.abort();
          }

          const result: "success" | "error" =
            msg.subtype === "success" && !msg.is_error ? "success" : "error";

          yield {
            type: "session.end",
            sessionId: runSessionId,
            result,
            costUsd,
            tokens: { input: tokensInput, output: tokensOutput },
            filesTouched: Array.from(filesTouched),
            ts: nowIso(),
          };
          endedNormally = true;
          break;
        }

        // After each iteration, also check the wall-clock cap as a safety net.
        if (
          !capExceededReason &&
          profile?.timeCapSeconds &&
          Number.isFinite(profile.timeCapSeconds) &&
          profile.timeCapSeconds > 0 &&
          Date.now() - startTimeMs > profile.timeCapSeconds * 1000
        ) {
          capExceededReason = `time cap exceeded (${profile.timeCapSeconds}s)`;
          ac.abort();
        }
        // Other system / status / partial / hook messages are ignored for
        // v0.1. We can add them as `log` events later if useful.
      }

      if (capExceededReason) {
        yield {
          type: "error",
          message: `cap exceeded: ${capExceededReason}`,
          ts: nowIso(),
        };
        yield {
          type: "session.end",
          sessionId: runSessionId,
          result: "error",
          costUsd,
          tokens: { input: tokensInput, output: tokensOutput },
          filesTouched: Array.from(filesTouched),
          ts: nowIso(),
        };
        endedNormally = true;
      }

      if (!endedNormally) {
        // Stream finished without a `result` message — synthesize one so the
        // UI never hangs in "running".
        yield {
          type: "session.end",
          sessionId: runSessionId,
          result: "error",
          costUsd,
          tokens: { input: tokensInput, output: tokensOutput },
          filesTouched: Array.from(filesTouched),
          ts: nowIso(),
        };
      }
    } catch (err) {
      // An AbortError from the SDK is expected when a cap is hit; surface
      // the cap reason instead of the raw abort message.
      const message = capExceededReason
        ? `cap exceeded: ${capExceededReason}`
        : (err as Error).message;
      yield {
        type: "error",
        message,
        ts: nowIso(),
      };
      yield {
        type: "session.end",
        sessionId: runSessionId,
        result: "error",
        costUsd,
        tokens: { input: tokensInput, output: tokensOutput },
        filesTouched: Array.from(filesTouched),
        ts: nowIso(),
      };
    } finally {
      if (timeCapTimer) clearTimeout(timeCapTimer);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    }
  },
};

import "server-only";

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Resolve the absolute path to the `claude` CLI binary. Next.js workers may
// not inherit the user's shell PATH (nvm-managed installs are a common
// casualty), so falling back to bare "claude" via posix_spawnp is unreliable.
// Resolution priority:
//   1. HIVE_CLAUDE_PATH env override
//   2. `command -v claude` from a login zsh
//   3. Common known locations (nvm pinned, .local, homebrew, /usr/local/bin)
//   4. Glob nvm versions dir as last resort
//   5. Fallback to bare "claude"
let cachedCliPath: string | null = null;

export function resolveClaudeCli(): string {
  if (cachedCliPath) return cachedCliPath;

  if (process.env.HIVE_CLAUDE_PATH && existsSync(process.env.HIVE_CLAUDE_PATH)) {
    cachedCliPath = process.env.HIVE_CLAUDE_PATH;
    return cachedCliPath;
  }

  try {
    const out = execSync("zsh -lc 'command -v claude'", {
      encoding: "utf8",
      timeout: 4000,
    }).trim();
    if (out && existsSync(out)) {
      cachedCliPath = out;
      return cachedCliPath;
    }
  } catch {
    // ignore, fall through
  }

  const home = homedir();
  const candidates = [
    join(home, ".nvm/versions/node/v22.14.0/bin/claude"),
    join(home, ".local/bin/claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      cachedCliPath = c;
      return cachedCliPath;
    }
  }

  try {
    const out = execSync(
      `ls -1 ${join(home, ".nvm/versions/node")}/*/bin/claude 2>/dev/null | head -1`,
      { encoding: "utf8", timeout: 2000, shell: "/bin/zsh" },
    ).trim();
    if (out && existsSync(out)) {
      cachedCliPath = out;
      return cachedCliPath;
    }
  } catch {
    // ignore
  }

  cachedCliPath = "claude";
  return cachedCliPath;
}

export function buildEnvWithClaudeDir(): NodeJS.ProcessEnv {
  const path = resolveClaudeCli();
  const dir = path !== "claude" ? path.slice(0, path.lastIndexOf("/")) : "";
  const currentPath = process.env.PATH ?? "";
  return {
    ...process.env,
    TERM: "xterm-256color",
    PATH: dir && !currentPath.split(":").includes(dir) ? `${dir}:${currentPath}` : currentPath,
  };
}

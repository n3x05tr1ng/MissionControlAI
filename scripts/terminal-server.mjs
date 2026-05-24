// Hive embedded-terminal server.
// Standalone Node ESM. Spawns PTYs and bridges them to WebSocket clients.

import { createServer } from "node:http";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { parse as parseUrl } from "node:url";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import Database from "better-sqlite3";

const PORT = Number(process.env.HIVE_TERMINAL_PORT || 3001);
const DB_PATH = resolve(process.cwd(), "data", "hive.db");

let cachedClaudePath = null;
function resolveClaudeCli() {
  if (cachedClaudePath) return cachedClaudePath;
  if (process.env.HIVE_CLAUDE_PATH && existsSync(process.env.HIVE_CLAUDE_PATH)) {
    cachedClaudePath = process.env.HIVE_CLAUDE_PATH;
    return cachedClaudePath;
  }
  try {
    const out = execSync("zsh -lc 'command -v claude'", { encoding: "utf8", timeout: 4000 }).trim();
    if (out && existsSync(out)) { cachedClaudePath = out; return cachedClaudePath; }
  } catch {}
  const home = homedir();
  for (const c of [
    join(home, ".nvm/versions/node/v22.14.0/bin/claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
  ]) if (existsSync(c)) { cachedClaudePath = c; return cachedClaudePath; }
  cachedClaudePath = "claude";
  return cachedClaudePath;
}
function claudeEnv(cwd) {
  const p = resolveClaudeCli();
  const dir = p !== "claude" ? p.slice(0, p.lastIndexOf("/")) : "";
  const path = process.env.PATH ?? "";
  return {
    ...process.env,
    TERM: "xterm-256color",
    PWD: cwd,
    PATH: dir && !path.split(":").includes(dir) ? `${dir}:${path}` : path,
  };
}

let db;
try {
  db = new Database(DB_PATH, { readonly: true, fileMustExist: false });
} catch (err) {
  console.error("[term] failed to open sqlite:", err.message);
  process.exit(0);
}

const pathStmt = (() => {
  try {
    return db.prepare("SELECT path FROM projects WHERE id = ?");
  } catch {
    return null;
  }
})();

function getProjectPath(id) {
  if (!pathStmt) return null;
  try {
    const row = pathStmt.get(id);
    return row ? row.path : null;
  } catch {
    return null;
  }
}

const sessions = new Map();
let sessionCounter = 0;

const http = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ptys: sessions.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

http.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[term] port ${PORT} in use — exiting cleanly`);
    process.exit(0);
  }
  console.error("[term] http error:", err.message);
  process.exit(0);
});

const wss = new WebSocketServer({ server: http, path: "/terminal" });

wss.on("connection", (ws, req) => {
  const sessionId = ++sessionCounter;
  const startedAt = Date.now();
  const query = parseUrl(req.url || "", true).query;
  const projectId = typeof query.projectId === "string" ? query.projectId : "";
  const shell = typeof query.shell === "string" ? query.shell : "claude";

  if (!projectId) {
    ws.close(1008, "missing projectId");
    return;
  }

  const cwd = getProjectPath(projectId);
  if (!cwd) {
    ws.close(1008, "project not found");
    return;
  }

  let cmd;
  let args;
  if (shell === "shell") {
    cmd = process.env.SHELL || "/bin/zsh";
    args = [];
  } else if (shell === "claude-resume") {
    cmd = resolveClaudeCli();
    args = ["--resume"];
  } else {
    cmd = resolveClaudeCli();
    args = [];
  }

  let term;
  try {
    term = pty.spawn(cmd, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd,
      env: claudeEnv(cwd),
    });
  } catch (err) {
    console.error(`[term] #${sessionId} spawn failed:`, err.message);
    ws.close(1011, "spawn failed");
    return;
  }

  sessions.set(sessionId, term);
  console.error(`[term] #${sessionId} open shell=${shell} project=${projectId} pid=${term.pid}`);

  let closed = false;
  const cleanup = (reason) => {
    if (closed) return;
    closed = true;
    sessions.delete(sessionId);
    try { term.kill(); } catch { /* noop */ }
    try { ws.close(); } catch { /* noop */ }
    const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.error(`[term] #${sessionId} close (${reason}) dur=${dur}s`);
  };

  term.onData((data) => {
    if (ws.readyState === 1) ws.send(data);
  });

  term.onExit(({ exitCode, signal }) => {
    cleanup(`pty-exit code=${exitCode} sig=${signal ?? "-"}`);
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "input" && typeof msg.data === "string") {
      try { term.write(msg.data); } catch { /* noop */ }
    } else if (msg.type === "resize" && Number.isFinite(msg.cols) && Number.isFinite(msg.rows)) {
      try { term.resize(Math.max(1, msg.cols | 0), Math.max(1, msg.rows | 0)); } catch { /* noop */ }
    } else if (msg.type === "ping") {
      try { ws.send(JSON.stringify({ type: "pong" })); } catch { /* noop */ }
    }
  });

  ws.on("close", () => cleanup("ws-close"));
  ws.on("error", (err) => {
    console.error(`[term] #${sessionId} ws error:`, err.message);
    cleanup("ws-error");
  });
});

http.listen(PORT, () => {
  console.error(`[term] listening on http://localhost:${PORT} (ws /terminal, http /healthz)`);
});

function shutdown(sig) {
  console.error(`[term] ${sig} — shutting down (${sessions.size} ptys)`);
  for (const t of sessions.values()) {
    try { t.kill(); } catch { /* noop */ }
  }
  sessions.clear();
  try { wss.close(); } catch { /* noop */ }
  try { http.close(); } catch { /* noop */ }
  setTimeout(() => process.exit(0), 200).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

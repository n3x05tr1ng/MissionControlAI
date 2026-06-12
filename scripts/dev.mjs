// Hive dev wrapper. Launches `next dev` and the terminal server side-by-side.

import { spawn } from "node:child_process";

const children = [];
let firstFailureCode = 0;
let shuttingDown = false;

function startChild(label, cmd, args, { critical = true } = {}) {
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  children.push({ label, child });

  const prefix = `[${label}] `;
  const pipe = (stream, target) => {
    let buf = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        target.write(prefix + line + "\n");
      }
    });
    stream.on("end", () => {
      if (buf.length) target.write(prefix + buf + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    process.stderr.write(`${prefix}exited code=${code} sig=${signal ?? "-"}\n`);
    if (shuttingDown || !critical) return;
    if (firstFailureCode === 0 && code && code !== 0) firstFailureCode = code;
    shutdown(signal === "SIGINT" ? "SIGINT" : "child-exit");
  });

  return child;
}

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stderr.write(`[dev] shutting down (${reason})\n`);
  for (const { child } of children) {
    if (!child.killed) {
      try { child.kill("SIGINT"); } catch { /* noop */ }
    }
  }
  setTimeout(() => {
    for (const { child } of children) {
      if (!child.killed) {
        try { child.kill("SIGTERM"); } catch { /* noop */ }
      }
    }
    setTimeout(() => process.exit(firstFailureCode), 500).unref();
  }, 1500).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// The terminal server is optional: if it dies we restart it a few times and
// otherwise keep Next running without the embedded terminal.
const TERM_MAX_RESTARTS = 3;
let termRestarts = 0;
function startTerminalServer() {
  const child = startChild("term", process.execPath, ["scripts/terminal-server.mjs"], { critical: false });
  child.on("exit", () => {
    if (shuttingDown) return;
    if (termRestarts < TERM_MAX_RESTARTS) {
      termRestarts += 1;
      process.stderr.write(`[dev] terminal server exited — restarting (${termRestarts}/${TERM_MAX_RESTARTS}) in 2s\n`);
      setTimeout(startTerminalServer, 2000).unref();
    } else {
      process.stderr.write("[dev] terminal server keeps exiting — continuing WITHOUT embedded terminal\n");
    }
  });
}

startChild("next", "npx", ["next", "dev"]);
startTerminalServer();

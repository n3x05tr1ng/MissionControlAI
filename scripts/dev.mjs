// Hive dev wrapper. Launches `next dev` and the terminal server side-by-side.

import { spawn } from "node:child_process";

const children = [];
let firstFailureCode = 0;
let shuttingDown = false;

function startChild(label, cmd, args) {
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
    if (firstFailureCode === 0 && code && code !== 0) firstFailureCode = code;
    process.stderr.write(`${prefix}exited code=${code} sig=${signal ?? "-"}\n`);
    if (!shuttingDown) shutdown(signal === "SIGINT" ? "SIGINT" : "child-exit");
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

startChild("next", "npx", ["next", "dev"]);
startChild("term", process.execPath, ["scripts/terminal-server.mjs"]);

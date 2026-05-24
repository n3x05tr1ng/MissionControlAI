import "server-only";
import { execSync, execFileSync, spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import pty from "node-pty";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLAUDE = "/Users/edwinmejia/.nvm/versions/node/v22.14.0/bin/claude";

export async function GET() {
  const out: Record<string, unknown> = {};
  out.claudeExists = existsSync(CLAUDE);
  try {
    out.realpath = realpathSync(CLAUDE);
  } catch (e) {
    out.realpath = `error: ${(e as Error).message}`;
  }
  out.PATH = process.env.PATH;
  out.SHELL = process.env.SHELL;

  try {
    out.execSync_version = execSync(`${CLAUDE} --version`, { encoding: "utf8", timeout: 8000 }).trim();
  } catch (e) {
    out.execSync_version = `ERR: ${(e as Error).message}`;
  }

  try {
    out.execFileSync_version = execFileSync(CLAUDE, ["--version"], { encoding: "utf8", timeout: 8000 }).trim();
  } catch (e) {
    out.execFileSync_version = `ERR: ${(e as Error).message}`;
  }

  // child_process.spawn with absolute path
  try {
    const p = spawn(CLAUDE, ["--version"], { stdio: "pipe" });
    let buf = "";
    p.stdout.on("data", (d) => (buf += d.toString()));
    await new Promise<void>((resolve, reject) => {
      p.on("exit", () => resolve());
      p.on("error", reject);
      setTimeout(() => { p.kill(); reject(new Error("timeout")); }, 8000);
    });
    out.spawn_version = buf.trim();
  } catch (e) {
    out.spawn_version = `ERR: ${(e as Error).message}`;
  }

  // pty.spawn with absolute path
  try {
    const term = pty.spawn(CLAUDE, ["--version"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });
    let buf = "";
    term.onData((d) => (buf += d));
    await new Promise<void>((resolve, reject) => {
      term.onExit(() => resolve());
      setTimeout(() => { try { term.kill(); } catch {} ; reject(new Error("timeout")); }, 8000);
    });
    out.pty_version = buf.trim();
  } catch (e) {
    out.pty_version = `ERR: ${(e as Error).message}`;
  }

  // pty.spawn wrapped in zsh -c
  try {
    const term = pty.spawn("/bin/zsh", ["-c", `${CLAUDE} --version`], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });
    let buf = "";
    term.onData((d) => (buf += d));
    await new Promise<void>((resolve, reject) => {
      term.onExit(() => resolve());
      setTimeout(() => { try { term.kill(); } catch {} ; reject(new Error("timeout")); }, 8000);
    });
    out.pty_zsh_version = buf.trim();
  } catch (e) {
    out.pty_zsh_version = `ERR: ${(e as Error).message}`;
  }

  return Response.json(out);
}

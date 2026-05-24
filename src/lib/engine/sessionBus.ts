import "server-only";

import type { AgentEvent } from "@/lib/contracts";

type Subscriber = (e: AgentEvent) => void;

const BUFFER_CAP = 200;

const subscribers = new Map<string, Set<Subscriber>>();
const buffers = new Map<string, AgentEvent[]>();

export function publish(projectId: string, e: AgentEvent): void {
  let buf = buffers.get(projectId);
  if (!buf) {
    buf = [];
    buffers.set(projectId, buf);
  }
  buf.push(e);
  if (buf.length > BUFFER_CAP) {
    buf.splice(0, buf.length - BUFFER_CAP);
  }

  const subs = subscribers.get(projectId);
  if (!subs) return;
  for (const sub of subs) {
    try {
      sub(e);
    } catch (err) {
      process.stderr.write(
        `[sessionBus] subscriber threw: ${(err as Error).message}\n`,
      );
    }
  }
}

export function subscribe(
  projectId: string,
  cb: Subscriber,
): () => void {
  let subs = subscribers.get(projectId);
  if (!subs) {
    subs = new Set();
    subscribers.set(projectId, subs);
  }
  subs.add(cb);
  return () => {
    const current = subscribers.get(projectId);
    if (!current) return;
    current.delete(cb);
    if (current.size === 0) {
      subscribers.delete(projectId);
    }
  };
}

export function getBuffer(projectId: string): AgentEvent[] {
  const buf = buffers.get(projectId);
  return buf ? buf.slice() : [];
}

export function clearBuffer(projectId: string): void {
  buffers.delete(projectId);
}

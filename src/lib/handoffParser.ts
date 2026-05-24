import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  HandoffSections,
  ParsedHandoff,
} from "@/lib/contracts";

const HEADING_TO_FIELD: Record<string, keyof HandoffSections> = {
  "Done this session": "doneThisSession",
  "Next step": "nextStep",
  Blockers: "blockers",
  "Open questions": "openQuestions",
  "Files touched": "filesTouched",
  "Context for next run": "contextForNextRun",
};

export function parseHandoff(markdown: string): ParsedHandoff {
  const sections: HandoffSections = {
    doneThisSession: null,
    nextStep: null,
    blockers: null,
    openQuestions: null,
    filesTouched: null,
    contextForNextRun: null,
  };

  const lines = markdown.split(/\r?\n/);
  type Block = { title: string; bodyLines: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const match = /^## (.*)$/.exec(line);
    if (match) {
      if (current) blocks.push(current);
      current = { title: match[1].trim(), bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) blocks.push(current);

  for (const block of blocks) {
    const field = HEADING_TO_FIELD[block.title];
    if (!field) continue;
    sections[field] = block.bodyLines.join("\n").trim();
  }

  return {
    sections,
    raw: markdown,
    parsedAt: new Date().toISOString(),
  };
}

export function readAndParseHandoff(projectPath: string): ParsedHandoff | null {
  const filePath = join(projectPath, ".claude", "handoff.md");
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
  return parseHandoff(raw);
}

import "server-only";

import {
  generateAutomationId,
  getAutomation,
  insertAutomation,
  insertStep,
  updateStep,
} from "@/lib/repos/automations";
import { getSettingRow, upsertSettingRow } from "@/lib/repos/settings";
import type { AutomationStepType } from "@/lib/contracts";

export interface AutomationStepTemplate {
  type: AutomationStepType;
  profileId: string | null;
  prompt: string | null;
  reviewsStepIndex?: number; // 1-based index of the step this reviews
  maxRetries?: number;
  waitForHuman?: boolean;
}

export interface AutomationTemplate {
  slug: string; // stable id to use on insert
  name: string;
  description: string;
  color: string;
  icon: string;
  steps: AutomationStepTemplate[];
}

export const DEFAULT_AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    slug: "content-pipeline",
    name: "Content Pipeline",
    description:
      "Researcher → Writer → Director review loop. Generates social-ready scripts.",
    color: "#5cc8ff",
    icon: "telescope",
    steps: [
      {
        type: "agent",
        profileId: "researcher",
        prompt:
          "Find 5 fresh content ideas about {{topic|the latest in AI tooling}} with brief rationale and 1 source per idea.",
      },
      {
        type: "agent",
        profileId: "doc-writer",
        prompt:
          "Using these ideas:\n\n{{step1.output}}\n\nWrite a 90-second social-media script for each. Format as #1 Title + Hook + Body + CTA.",
      },
      {
        type: "review_agent",
        profileId: "code-reviewer",
        reviewsStepIndex: 2,
        maxRetries: 2,
        prompt:
          "You are a Director reviewing scripts from the Writer (note: this profile is repurposed as Director). Are they engaging, on-brand, and under 90s when read?\n\nScripts to review:\n\n{{step2.output}}\n\nEnd with APPROVE on a single line, or `REJECT: <specific actionable feedback>`.",
      },
    ],
  },
  {
    slug: "daily-project-standup",
    name: "Daily Project Standup",
    description:
      "Summarizes recent activity across all projects into a first-person standup note.",
    color: "#ffd23f",
    icon: "clock",
    steps: [
      {
        type: "agent",
        profileId: "daily-summarizer",
        prompt:
          "Look up each registered project's recent activity. For each, report: name, last session ts, status, next step.",
      },
      {
        type: "agent",
        profileId: "doc-writer",
        prompt:
          "Using:\n\n{{step1.output}}\n\nWrite a 200-word standup note in first person.",
      },
    ],
  },
  {
    slug: "bug-triage-loop",
    name: "Bug Triage Loop",
    description:
      "Hunt → categorize → propose minimal fixes → review. Closes the loop on small bugs.",
    color: "#ff5c5c",
    icon: "bug",
    steps: [
      {
        type: "agent",
        profileId: "bug-hunter",
        prompt:
          "Scan recent error logs and notifications for this period. Output a list of distinct bugs with severity guess.",
      },
      {
        type: "agent",
        profileId: "architect",
        prompt:
          "From {{step1.output}}, categorize each bug by component.",
      },
      {
        type: "agent",
        profileId: "bug-hunter",
        prompt:
          "For each categorized bug in {{step2.output}}, propose the smallest reasonable fix.",
      },
      {
        type: "review_agent",
        profileId: "code-reviewer",
        reviewsStepIndex: 3,
        maxRetries: 2,
        prompt:
          "Review the proposed fixes in {{step3.output}}. APPROVE if minimally invasive and correct; otherwise `REJECT: <feedback>`.",
      },
    ],
  },
];

export interface SeedAutomationsResult {
  seeded: number;
}

const SEED_FLAG = "automations_seeded";

export function seedDefaultAutomationsIfEmpty(): SeedAutomationsResult {
  const flag = getSettingRow(SEED_FLAG);
  if (flag) return { seeded: 0 };

  let seeded = 0;
  for (const tpl of DEFAULT_AUTOMATION_TEMPLATES) {
    // Use slug as id if free; otherwise generate a unique variant.
    const desiredId = tpl.slug;
    const existing = getAutomation(desiredId);
    const id = existing ? generateAutomationId(tpl.name) : desiredId;
    const automation = insertAutomation({
      id,
      name: tpl.name,
      description: tpl.description,
      color: tpl.color,
      icon: tpl.icon,
      schedule: null,
      enabled: false,
      isTemplate: true,
    });

    // Insert steps in order, then patch reviews_step_id (we need the inserted
    // step ids to resolve indexes -> ids).
    const insertedIds: string[] = [];
    for (let i = 0; i < tpl.steps.length; i++) {
      const s = tpl.steps[i];
      const step = insertStep({
        automationId: automation.id,
        order: i + 1,
        type: s.type,
        profileId: s.profileId,
        prompt: s.prompt,
        reviewsStepId: null,
        maxRetries: s.maxRetries ?? 3,
        waitForHuman: s.waitForHuman ?? false,
      });
      insertedIds.push(step.id);
    }

    // Second pass: wire up reviews_step_id (needs the inserted step ids).
    for (let i = 0; i < tpl.steps.length; i++) {
      const s = tpl.steps[i];
      if (s.reviewsStepIndex && s.reviewsStepIndex >= 1) {
        const reviewedId = insertedIds[s.reviewsStepIndex - 1];
        if (reviewedId) {
          updateStep(insertedIds[i], { reviewsStepId: reviewedId });
        }
      }
    }

    seeded += 1;
  }

  upsertSettingRow(SEED_FLAG, "1");
  return { seeded };
}

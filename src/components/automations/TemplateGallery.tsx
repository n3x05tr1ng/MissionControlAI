"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ProfileIcon } from "@/components/icons/ProfileIcons";
import { createAutomationFromTemplate } from "@/components/automations/templateActions";
import type { Automation, AutomationStepType } from "@/lib/contracts";
import { notify } from "@/lib/ui/notify";

type Props = {
  templates: Automation[];
};

const STEP_CHIP: Record<AutomationStepType, { label: string; cls: string }> = {
  agent: { label: "Agent", cls: "bg-primary-soft text-primary" },
  review_agent: { label: "Review", cls: "bg-info-soft text-info" },
  human_review: { label: "Human", cls: "bg-warning-soft text-warning" },
};

function StepChain({ steps }: { steps: Automation["steps"] }) {
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  const shown = ordered.slice(0, 4);
  const extra = ordered.length - shown.length;
  if (ordered.length === 0) {
    return <span className="font-mono text-[11px] text-faint">No steps</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Pipeline preview">
      {shown.map((s, i) => {
        const chip = STEP_CHIP[s.type] ?? STEP_CHIP.agent;
        return (
          <span key={s.id} className="flex items-center gap-1.5">
            {i > 0 ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className="text-faint"
              >
                <path
                  d="M2 6h8m0 0L7 3m3 3L7 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${chip.cls}`}
            >
              {chip.label}
            </span>
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="font-mono text-[10px] text-faint">+{extra}</span>
      ) : null}
    </div>
  );
}

function TemplateCard({ template }: { template: Automation }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function use() {
    setBusy(true);
    try {
      const created = await createAutomationFromTemplate(template);
      notify.success(`Created "${created.name}" from template`);
      router.push(`/automations/${created.id}`);
      router.refresh();
    } catch (err) {
      notify.error(`Could not use template: ${(err as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-bevel hover:-translate-y-0.5 hover:border-border-strong">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full opacity-[0.10] blur-2xl group-hover:opacity-[0.16]"
        style={{ background: template.color }}
      />
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border"
          style={{
            color: template.color,
            background: `color-mix(in srgb, ${template.color} 12%, transparent)`,
          }}
        >
          <ProfileIcon name={template.icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-foreground">
            {template.name}
          </h3>
          {template.description ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
              {template.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-3">
        <StepChain steps={template.steps} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <span className="font-mono text-[11px] text-faint">
          {template.steps.length} step{template.steps.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => void use()}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
        >
          {busy ? (
            "Creating…"
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7 2.5v9M2.5 7h9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Use template
            </>
          )}
        </button>
      </div>
    </article>
  );
}

// Galería visible de plantillas (sustituye al <details> escondido):
// cards con preview del pipeline y CTA "Use template" que clona la plantilla.
export function TemplateGallery({ templates }: Props) {
  if (templates.length === 0) return null;
  return (
    <section id="templates" aria-label="Automation templates">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13px] font-medium text-foreground">Templates</h2>
        <span className="rounded-full border border-border bg-surface-2 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
          {templates.length}
        </span>
        <p className="text-[12px] text-faint">
          Start from a proven pipeline — one click creates your own copy.
        </p>
      </div>
      <div className="stagger-children grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {/* Wrapper div: la animación escalonada no debe pisar el hover-lift */}
        {templates.map((t) => (
          <div key={t.id} className="flex">
            <TemplateCard template={t} />
          </div>
        ))}
      </div>
    </section>
  );
}

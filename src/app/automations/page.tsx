import {
  AutomationCard,
  type LastRunSummary,
} from "@/components/automations/AutomationCard";
import { NewAutomationButton } from "@/components/automations/NewAutomationButton";
import { TemplateGallery } from "@/components/automations/TemplateGallery";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Automation } from "@/lib/contracts";
import { listAutomations } from "@/lib/repos/automations";
import { listRecentRuns } from "@/lib/repos/automationRuns";

export const dynamic = "force-dynamic";

function safeList(): Automation[] {
  try {
    return listAutomations({ includeTemplates: true });
  } catch {
    // Backend / schema may not be ready yet — degrade to empty list.
    return [];
  }
}

// Última ejecución por automatización (para salud + "last run" en las cards).
function safeLastRuns(): Map<string, LastRunSummary> {
  try {
    const map = new Map<string, LastRunSummary>();
    // listRecentRuns viene ordenado DESC por started_at: la primera
    // aparición de cada automationId es su run más reciente.
    for (const run of listRecentRuns(200)) {
      if (!map.has(run.automationId)) {
        map.set(run.automationId, {
          status: run.status,
          startedAt: run.startedAt,
          endedAt: run.endedAt,
        });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export default function AutomationsPage() {
  const all = safeList();
  const mine = all.filter((a) => !a.isTemplate);
  const templates = all.filter((a) => a.isTemplate);
  const lastRuns = safeLastRuns();

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        overline="Automations"
        title="Automations"
        description="Multi-step agent pipelines — chain agents, review loops, and human approval gates."
        actions={<NewAutomationButton />}
      />

      <section className="mb-10" aria-label="Your automations">
        <h2 className="mb-3 text-[13px] font-medium text-foreground">
          Your automations
        </h2>
        {mine.length === 0 ? (
          <EmptyState
            illustration="spark"
            title="No automations yet"
            description="Automations chain agent profiles into pipelines: agent, review, human approval. Start from a template or build your own."
            cta={{ label: "New automation", modal: "newAutomation" }}
            secondary={
              templates.length > 0
                ? { label: "Browse templates below", href: "#templates" }
                : undefined
            }
          />
        ) : (
          <div className="stagger-children grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {/* Wrapper div: la animación de entrada vive aquí para no pisar
                el transform del hover-lift de la card (fill-mode: both). */}
            {mine.map((a) => (
              <div key={a.id} className="flex">
                <AutomationCard
                  automation={a}
                  lastRun={lastRuns.get(a.id) ?? null}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <TemplateGallery templates={templates} />
    </section>
  );
}

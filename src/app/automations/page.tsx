import { AutomationCard } from "@/components/automations/AutomationCard";
import { NewAutomationButton } from "@/components/automations/NewAutomationButton";
import { EmptyState } from "@/components/EmptyState";
import type { Automation } from "@/lib/contracts";
import { listAutomations } from "@/lib/repos/automations";

export const dynamic = "force-dynamic";

function safeList(): Automation[] {
  try {
    return listAutomations({ includeTemplates: true });
  } catch {
    // Backend / schema may not be ready yet — degrade to empty list.
    return [];
  }
}

export default function AutomationsPage() {
  const all = safeList();
  const mine = all.filter((a) => !a.isTemplate);
  const templates = all.filter((a) => a.isTemplate);

  return (
    <section className="max-w-[1600px]">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-xs tracking-widest text-hive-amber">
            [ AUTOMATIONS ]
          </h1>
          <p className="mt-1 text-xs text-hive-muted">
            multi-step pipelines — agents, review loops, and human gates
          </p>
        </div>
        <NewAutomationButton />
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-hive-muted">
          Your automations
        </h2>
        {mine.length === 0 ? (
          <EmptyState
            title="No automations yet"
            description="Automations chain agent profiles into pipelines: agent → review → human approval. Start from a template or build your own."
            cta={{ label: "+ New automation", href: "#" }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mine.map((a) => (
              <AutomationCard key={a.id} automation={a} />
            ))}
          </div>
        )}
      </section>

      {templates.length > 0 ? (
        <section>
          <details>
            <summary className="mb-3 cursor-pointer font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-text">
              Templates ({templates.length}) — click to expand
            </summary>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((a) => (
                <AutomationCard key={a.id} automation={a} />
              ))}
            </div>
          </details>
        </section>
      ) : null}
    </section>
  );
}

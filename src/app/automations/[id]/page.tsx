import Link from "next/link";
import { notFound } from "next/navigation";

import { AutomationEditorHeader } from "@/components/automations/AutomationEditorHeader";
import { AutomationStepsEditor } from "@/components/automations/AutomationStepsEditor";
import { RecentRunsPanel } from "@/components/automations/RecentRunsPanel";
import type { Automation } from "@/lib/contracts";
import { getAutomation } from "@/lib/repos/automations";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function safeGet(id: string): Automation | null {
  try {
    return getAutomation(id);
  } catch {
    return null;
  }
}

export default async function AutomationEditorPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const automation = safeGet(id);
  if (!automation) notFound();

  return (
    <section className="max-w-[1400px] flex flex-col gap-5">
      <nav className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-hive-muted">
        <Link href="/automations" className="hover:text-hive-amber">
          ← Automations
        </Link>
      </nav>

      <AutomationEditorHeader automation={automation} />

      <AutomationStepsEditor
        automationId={automation.id}
        initialSteps={automation.steps}
      />

      <RecentRunsPanel automationId={automation.id} />
    </section>
  );
}

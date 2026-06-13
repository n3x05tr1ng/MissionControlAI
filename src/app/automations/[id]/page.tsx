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
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <nav
        aria-label="Breadcrumb"
        className="animate-enter flex items-center gap-1.5 text-[12px] text-faint"
      >
        <Link href="/automations" className="hover:text-foreground">
          Automations
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-muted-foreground">
          {automation.name}
        </span>
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

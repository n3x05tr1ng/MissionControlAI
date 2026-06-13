import { AssistantChat } from "@/components/AssistantChat";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

// Full-viewport chat column: 100dvh minus the shell chrome —
// TopBar (48px) + StatusBar (28px) + main p-6 (24px × 2) = 124px.
export default function AssistantPage() {
  return (
    <section className="mx-auto flex h-[calc(100dvh-124px)] min-h-[420px] w-full max-w-5xl flex-col">
      <PageHeader
        overline="Assistant"
        title="Assistant"
        description="Chat with your portfolio — it can read project state, create reminders, and trigger runs."
      />
      <AssistantChat />
    </section>
  );
}

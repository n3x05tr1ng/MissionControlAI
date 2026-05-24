import { AssistantChat } from "@/components/AssistantChat";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <section className="max-w-5xl">
      <header className="mb-4">
        <h1 className="font-mono text-xs tracking-widest text-hive-amber">
          [ ASSISTANT ]
        </h1>
      </header>
      <AssistantChat />
    </section>
  );
}

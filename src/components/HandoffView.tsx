import { EmptyState } from "@/components/EmptyState";
import type { HandoffSections, ParsedHandoff } from "@/lib/contracts";

type Props = {
  handoff: ParsedHandoff | null;
};

const SECTIONS: Array<{ key: keyof HandoffSections; label: string }> = [
  { key: "doneThisSession", label: "Done this session" },
  { key: "nextStep", label: "Next step" },
  { key: "blockers", label: "Blockers" },
  { key: "openQuestions", label: "Open questions" },
  { key: "filesTouched", label: "Files touched" },
  { key: "contextForNextRun", label: "Context for next run" },
];

export function HandoffView({ handoff }: Props) {
  if (!handoff) {
    return (
      <EmptyState
        illustration="folder"
        title="No handoff yet"
        description="When a session ends, the agent leaves a handoff note here so the next run knows exactly where to pick up."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-1 shadow-bevel">
      <div className="stagger-children divide-y divide-border">
        {SECTIONS.map(({ key, label }) => {
          const body = handoff.sections[key];
          return (
            <section key={key} className="p-4">
              <h3 className="text-[12px] font-medium text-muted-foreground">
                {label}
              </h3>
              {body && body.trim().length > 0 ? (
                <pre className="mt-2 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/90">
                  {body}
                </pre>
              ) : (
                <p className="mt-2 text-[12px] text-faint">—</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

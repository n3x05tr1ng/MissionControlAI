import type { HandoffSections, ParsedHandoff } from "@/lib/contracts";

type Props = {
  handoff: ParsedHandoff | null;
};

const SECTIONS: Array<{ key: keyof HandoffSections; label: string }> = [
  { key: "doneThisSession", label: "DONE THIS SESSION" },
  { key: "nextStep", label: "NEXT STEP" },
  { key: "blockers", label: "BLOCKERS" },
  { key: "openQuestions", label: "OPEN QUESTIONS" },
  { key: "filesTouched", label: "FILES TOUCHED" },
  { key: "contextForNextRun", label: "CONTEXT FOR NEXT RUN" },
];

export function HandoffView({ handoff }: Props) {
  if (!handoff) {
    return (
      <div className="border border-hive-border bg-hive-panel p-4">
        <p className="text-sm text-hive-muted">No handoff yet</p>
      </div>
    );
  }

  return (
    <div className="border border-hive-border bg-hive-panel">
      <div className="divide-y divide-hive-border">
        {SECTIONS.map(({ key, label }) => {
          const body = handoff.sections[key];
          return (
            <section key={key} className="p-4">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
                [ {label} ]
              </h3>
              {body && body.trim().length > 0 ? (
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-hive-text/90">
                  {body}
                </pre>
              ) : (
                <p className="mt-2 font-mono text-xs text-hive-muted">—</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

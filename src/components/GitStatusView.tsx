import type { GitInfo } from "@/lib/contracts";
import { formatRelative } from "@/lib/time";

type Props = {
  git: GitInfo | null;
};

function BranchIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="4.5" cy="3.5" r="1.8" />
      <circle cx="4.5" cy="12.5" r="1.8" />
      <circle cx="11.5" cy="5" r="1.8" />
      <path d="M4.5 5.3v5.4M11.5 6.8c0 2.6-3 3.2-5 3.6" />
    </svg>
  );
}

export function GitStatusView({ git }: Props) {
  if (!git) {
    return (
      <div className="rounded-lg border border-border bg-surface-1 p-4 shadow-bevel">
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <BranchIcon className="h-3.5 w-3.5 text-faint" />
          Not a git repository
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4 shadow-bevel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-[12px] text-foreground">
          <BranchIcon className="h-3 w-3 text-muted-foreground" />
          {git.branch || "(detached)"}
        </span>
        {git.dirty ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 font-mono text-[11px] text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
            dirty
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 font-mono text-[11px] text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            clean
          </span>
        )}
      </div>

      {git.lastCommit ? (
        <div className="mt-3">
          <div className="flex items-center gap-2 font-mono text-[12px]">
            <code className="text-primary">{git.lastCommit.hash}</code>
            <span className="text-faint">
              {formatRelative(git.lastCommit.date)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-foreground/90">
            {git.lastCommit.message}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-muted-foreground">No commits yet</p>
      )}
    </div>
  );
}

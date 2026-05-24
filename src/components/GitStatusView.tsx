import type { GitInfo } from "@/lib/contracts";
import { formatRelative } from "@/lib/time";

type Props = {
  git: GitInfo | null;
};

export function GitStatusView({ git }: Props) {
  if (!git) {
    return (
      <div className="border border-hive-border bg-hive-panel p-4">
        <p className="text-sm text-hive-muted">Not a git repo</p>
      </div>
    );
  }

  return (
    <div className="border border-hive-border bg-hive-panel p-4">
      <div className="flex items-center justify-between gap-2 font-mono text-xs">
        <span className="inline-flex items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              git.dirty ? "bg-hive-amber" : "bg-hive-green"
            }`}
            aria-label={git.dirty ? "dirty" : "clean"}
          />
          <code className="text-hive-text">{git.branch || "(detached)"}</code>
          <span className="text-hive-muted uppercase">
            {git.dirty ? "dirty" : "clean"}
          </span>
        </span>
      </div>

      {git.lastCommit ? (
        <div className="mt-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <code className="text-hive-amber">{git.lastCommit.hash}</code>
            <span className="text-hive-muted">
              {formatRelative(git.lastCommit.date)}
            </span>
          </div>
          <p className="mt-1 text-hive-text/80 line-clamp-2">
            {git.lastCommit.message}
          </p>
        </div>
      ) : (
        <p className="mt-3 font-mono text-xs text-hive-muted">No commits yet</p>
      )}
    </div>
  );
}

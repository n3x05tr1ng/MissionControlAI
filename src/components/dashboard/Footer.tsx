import "server-only";

import { formatTokens } from "@/lib/format";

type Props = {
  totalRuns: number;
  totalTokens: number;
  topProfile: string | null;
  uptimeStartedAt: string | null;
};

function fmtUptime(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function DashboardFooter({
  totalRuns,
  totalTokens,
  topProfile,
  uptimeStartedAt,
}: Props) {
  // If totals are 0 the footer is just noise — keep the dashboard clean.
  if (totalRuns === 0 && totalTokens === 0 && !topProfile && !uptimeStartedAt) {
    return null;
  }

  const parts: string[] = [];
  if (totalRuns > 0) {
    parts.push(`${totalRuns} run${totalRuns === 1 ? "" : "s"}`);
  }
  if (totalTokens > 0) {
    parts.push(`${formatTokens(totalTokens)} tokens`);
  }
  if (topProfile) {
    parts.push(`top profile: ${topProfile}`);
  }
  const uptime = fmtUptime(uptimeStartedAt);
  if (uptime) {
    parts.push(`uptime ${uptime}`);
  }

  if (parts.length === 0) return null;

  return (
    <footer className="border-t border-hive-border pt-3 text-center font-mono text-xs text-hive-muted">
      all time: {parts.join(" · ")}
    </footer>
  );
}

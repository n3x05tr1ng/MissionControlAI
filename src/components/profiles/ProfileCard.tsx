import Link from "next/link";

import type { AgentProfile } from "@/lib/contracts";
import { ProfileIcon } from "@/components/icons/ProfileIcons";

type Props = {
  profile: AgentProfile;
};

function permLabel(mode: AgentProfile["permissionMode"]): string {
  switch (mode) {
    case "plan":
      return "plan";
    case "default":
      return "default";
    case "acceptEdits":
      return "accept-edits";
    case "bypassPermissions":
      return "bypass";
  }
}

export function ProfileCard({ profile }: Props) {
  const description = profile.description ?? "";

  return (
    <Link
      href={`/profiles/${profile.id}`}
      className="group relative flex flex-col border border-hive-border bg-hive-panel hover:border-hive-amber/60 transition-colors"
    >
      <div
        className="h-3 w-full"
        style={{ backgroundColor: profile.color }}
        aria-hidden="true"
      />
      {profile.isTemplate ? (
        <span className="absolute right-2 top-5 font-mono text-[9px] uppercase tracking-widest text-hive-muted border border-hive-border bg-hive-bg/60 px-1.5 py-0.5">
          TEMPLATE
        </span>
      ) : null}
      <div className="flex items-start gap-3 p-4">
        <div
          className="flex h-10 w-10 items-center justify-center border border-hive-border"
          style={{ color: profile.color }}
        >
          <ProfileIcon name={profile.icon} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-base text-hive-text group-hover:text-hive-amber transition-colors truncate">
            {profile.name}
          </h3>
          <p
            className="mt-1 text-xs text-hive-muted overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {description}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-hive-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-hive-muted">
        <span className="truncate">{profile.model}</span>
        <span>{profile.allowedTools.length} tools</span>
        <span>{profile.mcpServers.length} mcp</span>
        <span className="text-hive-amber/80">{permLabel(profile.permissionMode)}</span>
      </div>
    </Link>
  );
}

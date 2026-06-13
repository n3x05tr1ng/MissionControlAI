import Link from "next/link";

import type { AgentProfile } from "@/lib/contracts";
import { ProfileIcon } from "@/components/icons/ProfileIcons";

type Props = {
  profile: AgentProfile;
};

const PERMISSION_BADGES: Record<
  AgentProfile["permissionMode"],
  { label: string; className: string }
> = {
  plan: { label: "Plan", className: "bg-info-soft text-info" },
  default: {
    label: "Default",
    className: "border border-border bg-surface-2 text-muted-foreground",
  },
  acceptEdits: {
    label: "Accept edits",
    className: "bg-success-soft text-success",
  },
  bypassPermissions: { label: "Bypass", className: "bg-warning-soft text-warning" },
};

/* Iconos de metadata: 13px, stroke 1.5 — mismas convenciones que ProfileIcons */

function MetaSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-faint"
    >
      {children}
    </svg>
  );
}

function CpuIcon() {
  return (
    <MetaSvg>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="10" y="10" width="4" height="4" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </MetaSvg>
  );
}

function ToolIcon() {
  return (
    <MetaSvg>
      <path d="M14.7 6.3a4 4 0 1 0 3 3l-4 4-6 6-3-3 6-6 4-4z" />
    </MetaSvg>
  );
}

function ServerIcon() {
  return (
    <MetaSvg>
      <rect x="4" y="4" width="16" height="7" rx="2" />
      <rect x="4" y="13" width="16" height="7" rx="2" />
      <path d="M8 7.5h.01M8 16.5h.01" />
    </MetaSvg>
  );
}

export function ProfileCard({ profile }: Props) {
  const description = profile.description ?? "";
  const perm = PERMISSION_BADGES[profile.permissionMode];

  return (
    <Link
      href={`/profiles/${profile.id}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-bevel hover:-translate-y-0.5 hover:border-border-strong"
    >
      {/* Glow de identidad: el color del perfil como atmósfera, no como franja */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full opacity-25 blur-2xl transition-opacity duration-150 group-hover:opacity-45"
        style={{
          background: `radial-gradient(closest-side, ${profile.color}, transparent)`,
        }}
      />

      <div className="relative flex items-start gap-3 p-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border"
          style={{
            color: profile.color,
            borderColor: `color-mix(in srgb, ${profile.color} 35%, transparent)`,
            background: `color-mix(in srgb, ${profile.color} 12%, transparent)`,
          }}
        >
          <ProfileIcon name={profile.icon} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-medium text-foreground transition-colors duration-150 group-hover:text-primary">
              {profile.name}
            </h3>
            {profile.isTemplate ? (
              <span className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground">
                Template
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : (
            <p className="mt-1 text-[13px] leading-relaxed text-faint">
              No description yet.
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-auto flex items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span
          className="inline-flex min-w-0 items-center gap-1.5"
          title={`Model: ${profile.model}`}
        >
          <CpuIcon />
          <span className="truncate font-mono text-[11px]">{profile.model}</span>
        </span>
        <span
          className="inline-flex shrink-0 items-center gap-1.5"
          title="Allowed tools"
        >
          <ToolIcon />
          {profile.allowedTools.length}
        </span>
        <span
          className="inline-flex shrink-0 items-center gap-1.5"
          title="MCP servers"
        >
          <ServerIcon />
          {profile.mcpServers.length}
        </span>
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${perm.className}`}
          title="Permission mode"
        >
          {perm.label}
        </span>
      </div>
    </Link>
  );
}

import "server-only";

import { HeroFirstRunActions } from "@/components/dashboard/HeroFirstRunActions";
import { HexIcon } from "@/components/icons/HexIcon";
import { formatTokens } from "@/lib/format";

type Props = {
  firstRun: boolean;
  projectsCount: number;
  runningCount: number;
  needsInputCount: number;
  blockedCount: number;
  tokensThisMonth: number;
};

/* --------------------------- inline icon set ----------------------------- */
/* 14px, stroke 1.5, currentColor — same grammar as HexIcon. */

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function FolderIcon() {
  return (
    <IconBase>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </IconBase>
  );
}

function BoltIcon() {
  return (
    <IconBase>
      <path d="M13 2.5 5 13.5h6L11 21.5l8-11h-6z" />
    </IconBase>
  );
}

function AlertIcon() {
  return (
    <IconBase>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 10v4M12 17.2v.3" />
    </IconBase>
  );
}

function TokenIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M8.5 10h7M8.5 14h7" />
    </IconBase>
  );
}

/* ----------------------- atmosphere (code-generated) ---------------------- */

function HeroAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* Local amber glow, top-right */}
      <div
        className="absolute -right-20 -top-28 h-72 w-[30rem]"
        style={{
          background:
            "radial-gradient(closest-side, var(--primary-soft), transparent)",
          filter: "blur(40px)",
        }}
      />
      {/* Cool counter-glow, bottom-left */}
      <div
        className="absolute -bottom-32 -left-16 h-64 w-80 opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, var(--info-soft), transparent)",
          filter: "blur(48px)",
        }}
      />
      {/* Faded dot grid for the technical feel */}
      <div className="dot-grid absolute inset-0" />
      {/* Brand watermark */}
      <HexIcon
        size={190}
        strokeWidth={0.6}
        className="absolute -right-10 -top-12 text-primary opacity-[0.08]"
      />
    </div>
  );
}

/* ------------------------------ stat pills -------------------------------- */

type Pill = {
  href: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  /** Tailwind class for the number. */
  valueClass: string;
  hint: string;
  pulse?: boolean;
};

function StatPill({ pill }: { pill: Pill }) {
  return (
    <a
      href={pill.href}
      className="group relative flex flex-col gap-1 rounded-lg border border-border bg-surface-2/60 p-3.5 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2"
    >
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
        {pill.icon}
        {pill.label}
      </span>
      <span
        className={`flex items-baseline gap-2 text-2xl font-semibold tabular-nums ${pill.valueClass}`}
      >
        {pill.value}
        {pill.pulse ? (
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
            aria-hidden="true"
          />
        ) : null}
      </span>
      <span className="text-[11px] text-faint opacity-0 transition-opacity group-hover:opacity-100">
        {pill.hint}
      </span>
    </a>
  );
}

export function Hero({
  firstRun,
  projectsCount,
  runningCount,
  needsInputCount,
  blockedCount,
  tokensThisMonth,
}: Props) {
  // First-run hero replaces the stat band until the user adds a project.
  if (firstRun && projectsCount === 0) {
    return (
      <section className="noise animate-enter relative overflow-hidden rounded-2xl border border-border bg-surface-1 p-6 shadow-bevel">
        <HeroAtmosphere />
        <div className="relative flex items-start gap-4">
          <div className="relative shrink-0">
            <div
              aria-hidden
              className="absolute -inset-3 rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, var(--primary-soft), transparent)",
                filter: "blur(10px)",
              }}
            />
            <HexIcon
              size={40}
              strokeWidth={1.25}
              className="relative text-primary"
            />
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Hive is your command center for every AI coding project running in
            parallel. Add a project, queue tasks on the Kanban board, and let
            agents run while you watch the live feed. Start with one of the
            shortcuts below.
          </p>
        </div>
        <HeroFirstRunActions />
      </section>
    );
  }

  const attention = needsInputCount + blockedCount;

  const pills: Pill[] = [
    {
      href: "#projects",
      label: "projects",
      value: String(projectsCount),
      icon: <FolderIcon />,
      valueClass: "text-foreground",
      hint: "Jump to the grid",
    },
    {
      href: "#active-now",
      label: "running",
      value: String(runningCount),
      icon: <BoltIcon />,
      valueClass: runningCount > 0 ? "text-primary" : "text-muted-foreground",
      hint: "See live runs",
      pulse: runningCount > 0,
    },
    {
      href: "#attention",
      label: "needs attention",
      value: String(attention),
      icon: <AlertIcon />,
      valueClass: attention > 0 ? "text-destructive" : "text-muted-foreground",
      hint: attention > 0 ? "Review what's stuck" : "All clear",
    },
    {
      href: "#activity",
      label: "tokens · month",
      value: tokensThisMonth > 0 ? formatTokens(tokensThisMonth) : "0",
      icon: <TokenIcon />,
      valueClass: "text-foreground",
      hint: "Open activity",
    },
  ];

  return (
    <section
      aria-label="Workspace overview"
      className="noise animate-enter relative overflow-hidden rounded-2xl border border-border bg-surface-1 p-5 shadow-bevel"
    >
      <HeroAtmosphere />
      <div className="stagger-children relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        {pills.map((p) => (
          <StatPill key={p.label} pill={p} />
        ))}
      </div>
    </section>
  );
}

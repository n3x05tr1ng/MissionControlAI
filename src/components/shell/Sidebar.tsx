"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BackgroundRunsWidget } from "@/components/shell/BackgroundRunsWidget";
import { HexIcon as HexIconCmp } from "@/components/icons/HexIcon";
import { BlueprintIcon, BrainIcon } from "@/components/icons/ProfileIcons";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const HexIcon = <HexIconCmp />;

const BoardIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="5" height="16" rx="1" />
    <rect x="10" y="4" width="5" height="10" rx="1" />
    <rect x="17" y="4" width="4" height="13" rx="1" />
  </svg>
);

const ChatIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12z" />
  </svg>
);

const BellIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

const GearIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </svg>
);

const ProfilesIcon = <BrainIcon size={16} strokeWidth={1.75} />;
const AutomationsIcon = <BlueprintIcon size={16} strokeWidth={1.75} />;

const SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Projects", icon: HexIcon },
      { href: "/board", label: "Board", icon: BoardIcon },
      { href: "/assistant", label: "Assistant", icon: ChatIcon },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/automations", label: "Automations", icon: AutomationsIcon },
      { href: "/profiles", label: "Profiles", icon: ProfilesIcon },
      { href: "/reminders", label: "Reminders", icon: BellIcon },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: GearIcon }],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/projects");
  }
  // Run detail pages live under /automation-runs but belong to Automations.
  if (href === "/automations" && pathname.startsWith("/automation-runs")) {
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-border bg-surface-1/70 backdrop-blur-md">
      {/* Logo / marca — alineado con la titlebar de 48px */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-4">
        <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-primary-soft blur-md" />
          <Image
            src="/hive-logo.svg"
            alt=""
            width={22}
            height={22}
            priority
            unoptimized
            className="relative"
          />
        </span>
        <span className="font-mono text-sm font-medium tracking-[0.18em] text-foreground">
          HIVE
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Main">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2.5 pb-1.5 pt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] ${
                        active
                          ? "bg-surface-3 text-foreground"
                          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute -left-1.5 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_0_var(--color-primary)]"
                        />
                      ) : null}
                      <span
                        className={
                          active
                            ? "text-primary"
                            : "text-faint group-hover:text-muted-foreground"
                        }
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border">
        <BackgroundRunsWidget />
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
          local-first
        </p>
      </div>
    </aside>
  );
}

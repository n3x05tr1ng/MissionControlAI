import Link from "next/link";

import { BackgroundRunsWidget } from "@/components/shell/BackgroundRunsWidget";
import { HexIcon as HexIconCmp } from "@/components/icons/HexIcon";
import { BlueprintIcon, BrainIcon } from "@/components/icons/ProfileIcons";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const HexIcon = <HexIconCmp />;

const CircleIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8" />
  </svg>
);

const DiamondIcon = (
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
    <path d="M12 3 21 12 12 21 3 12z" />
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

const NAV: NavItem[] = [
  { href: "/", label: "Projects", icon: HexIcon },
  { href: "/automations", label: "Automations", icon: AutomationsIcon },
  { href: "/profiles", label: "Profiles", icon: ProfilesIcon },
  { href: "/assistant", label: "Assistant", icon: CircleIcon },
  { href: "/reminders", label: "Reminders", icon: DiamondIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 w-[240px] border-r border-hive-border bg-hive-panel flex flex-col">
      <div className="h-12 flex items-center gap-2 px-4 border-b border-hive-border">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          className="text-hive-amber"
          aria-hidden="true"
        >
          <path d="M12 2 21 7v10l-9 5-9-5V7z" />
        </svg>
        <span className="font-mono text-sm tracking-widest text-hive-amber">
          HIVE
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="flex flex-col">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 px-4 py-2 text-sm text-hive-text/80 hover:text-hive-amber hover:bg-hive-bg/40 transition-colors"
              >
                <span className="text-hive-muted group-hover:text-hive-amber transition-colors">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-hive-border">
        <BackgroundRunsWidget />
      </div>
      <div className="px-4 py-3 border-t border-hive-border">
        <p className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
          [ local-first ]
        </p>
      </div>
    </aside>
  );
}

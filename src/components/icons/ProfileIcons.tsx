import type { ReactNode } from "react";

type Props = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

function Svg({
  size = 20,
  className,
  strokeWidth = 1.5,
  children,
}: Props & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function HexagonIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
    </Svg>
  );
}

export function BrainIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 3 3h1V3H9z" />
      <path d="M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-3 3h-1V3h1z" />
    </Svg>
  );
}

export function BugIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="6" y="8" width="12" height="12" rx="6" />
      <path d="M9 5 8 3M15 5l1-2M3 12h3M18 12h3M5 18l-2 1M19 18l2 1M5 9 3 8M19 9l2-1" />
      <path d="M12 8v12" />
    </Svg>
  );
}

export function WrenchIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M14.7 6.3a4 4 0 1 0 3 3l-4 4-6 6-3-3 6-6 4-4z" />
    </Svg>
  );
}

export function DocIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </Svg>
  );
}

export function BeakerIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M9 3h6M10 3v6L4 20h16L14 9V3" />
      <path d="M7 15h10" />
    </Svg>
  );
}

export function TelescopeIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M3 13 17 5l3 5-14 8z" />
      <path d="M7 14l3 5M12 12l3 5M9 21h6" />
    </Svg>
  );
}

export function BlueprintIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 9h18M9 4v16M9 14h6" />
    </Svg>
  );
}

export function BookmarkIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </Svg>
  );
}

export function ClockIcon(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export const PROFILE_ICON_NAMES = [
  "hexagon",
  "brain",
  "bug",
  "wrench",
  "doc",
  "beaker",
  "telescope",
  "blueprint",
  "bookmark",
  "clock",
] as const;

export type ProfileIconName = (typeof PROFILE_ICON_NAMES)[number];

export function ProfileIcon({
  name,
  size,
  className,
  strokeWidth,
}: Props & { name: string }) {
  const p = { size, className, strokeWidth };
  switch (name) {
    case "brain":
      return <BrainIcon {...p} />;
    case "bug":
      return <BugIcon {...p} />;
    case "wrench":
      return <WrenchIcon {...p} />;
    case "doc":
      return <DocIcon {...p} />;
    case "beaker":
      return <BeakerIcon {...p} />;
    case "telescope":
      return <TelescopeIcon {...p} />;
    case "blueprint":
      return <BlueprintIcon {...p} />;
    case "bookmark":
      return <BookmarkIcon {...p} />;
    case "clock":
      return <ClockIcon {...p} />;
    case "hexagon":
    default:
      return <HexagonIcon {...p} />;
  }
}

export const PROFILE_COLOR_SWATCHES: ReadonlyArray<string> = [
  "#FFB000",
  "#3ddc97",
  "#ff5c5c",
  "#5cc8ff",
  "#ffd23f",
  "#b366ff",
  "#ff66b3",
  "#6699ff",
  "#ff8c1a",
  "#ff5cad",
];

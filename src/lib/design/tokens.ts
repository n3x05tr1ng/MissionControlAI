// Hive design tokens. Imported by UI components for inline styles when Tailwind
// utility classes don't fit (status colors, charts, dynamic values).

export const colors = {
  bg: "#0b0d0f",
  panel: "#13161a",
  panelBorder: "#23282e",
  text: "#e6e6e6",
  textMuted: "#7a8088",
  amber: "#FFB000",
  amberDim: "#a87400",
  green: "#3ddc97",
  red: "#ff5c5c",
  cyan: "#5cc8ff",
  yellow: "#ffd23f",
} as const;

export const statusColor: Record<string, string> = {
  idle: colors.textMuted,
  running: colors.amber,
  "needs-input": colors.cyan,
  blocked: colors.red,
  done: colors.green,
};

export const fonts = {
  sans: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono), ui-monospace, 'JetBrains Mono', Menlo, monospace",
} as const;

"use client";

import { useSyncExternalStore } from "react";

// Recharts paints SVG presentation attributes, which can't resolve CSS
// var() references — so we read the design tokens off :root at runtime.
// The literals below mirror globals.css and are only ever used for the
// pre-hydration frame (ResponsiveContainer renders nothing until it can
// measure the DOM, so they are never actually painted).
export interface ChartTokens {
  primary: string;
  info: string;
  border: string;
  faint: string;
  mutedForeground: string;
}

const TOKEN_FALLBACKS: ChartTokens = {
  primary: "oklch(0.78 0.14 78)",
  info: "oklch(0.76 0.115 235)",
  border: "oklch(1 0 0 / 8%)",
  faint: "oklch(0.53 0.008 85)",
  mutedForeground: "oklch(0.7 0.008 85)",
};

// Cached so the client snapshot keeps a stable identity between renders
// (a requirement of useSyncExternalStore) — the tokens only change with a
// full page load anyway, since the theme lives in static CSS.
let cachedTokens: ChartTokens | null = null;

function readTokensFromDom(): ChartTokens {
  if (cachedTokens) return cachedTokens;
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => {
    const v = cs.getPropertyValue(name).trim();
    return v.length > 0 ? v : fallback;
  };
  cachedTokens = {
    primary: read("--primary", TOKEN_FALLBACKS.primary),
    info: read("--info", TOKEN_FALLBACKS.info),
    border: read("--border", TOKEN_FALLBACKS.border),
    faint: read("--faint", TOKEN_FALLBACKS.faint),
    mutedForeground: read(
      "--muted-foreground",
      TOKEN_FALLBACKS.mutedForeground,
    ),
  };
  return cachedTokens;
}

const subscribeNever = () => () => {};

export function useChartTokens(): ChartTokens {
  return useSyncExternalStore(
    subscribeNever,
    readTokensFromDom,
    () => TOKEN_FALLBACKS,
  );
}

// Shared recharts tooltip styles — plain inline CSS, so var() works here.
export const chartTooltipContentStyle: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-overlay)",
  color: "var(--foreground)",
  fontSize: 12,
};

export const chartTooltipLabelStyle: React.CSSProperties = {
  color: "var(--faint)",
  fontFamily: "var(--font-mono)",
};

/**
 * BRAND — single source of truth for the product identity inside the web app.
 *
 * "Hive" and its logo are PLACEHOLDERS. To rebrand the app, edit this file and
 * follow the full checklist in BRANDING.md at the repo root (icons, desktop
 * app name, favicon, README).
 */
export const BRAND = {
  /** Product name as written in prose ("Hive"). */
  name: "Hive",
  /** Wordmark next to the logo in the sidebar (usually uppercase). */
  wordmark: "HIVE",
  /** Shown in the browser tab and in metadata. */
  tagline:
    "Agentic OS — one place to manage every AI project you're running in parallel.",
  /** Displayed in the status bar. Keep in sync with package.json. */
  version: "0.1.0",
  /** Logo file inside /public. Replace the file or point this elsewhere. */
  logoSrc: "/hive-logo.svg",
} as const;

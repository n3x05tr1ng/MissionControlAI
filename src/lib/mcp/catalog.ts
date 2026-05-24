import "server-only";

export interface McpCatalogEntry {
  id: string;
  label: string;
  description: string;
  configHint: string;
  defaultEnabled: boolean;
}

// Curated list of MCP servers known to Hive for v0.3. The id matches the
// Claude Code tool-name prefix (`mcp__<id>__<tool>`), so toggling here will
// later allow Hive to scope tool exposure per agent profile.
export const MCP_CATALOG: McpCatalogEntry[] = [
  {
    id: "claude_ai_Notion",
    label: "Notion",
    description: "Read/write pages, databases, comments, and search Notion.",
    configHint: "Connect via Notion integration token in Claude.ai.",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_Supabase",
    label: "Supabase",
    description: "Manage projects, tables, migrations, edge functions, logs.",
    configHint: "Service role or personal access token.",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_Mercury",
    label: "Mercury",
    description: "Read accounts, transactions, invoices, and recipients.",
    configHint: "Mercury API key with read-only scope.",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_Intuit_QuickBooks",
    label: "QuickBooks",
    description: "Invoices, payroll, P&L, balance sheet, AR/AP aging.",
    configHint: "OAuth via Intuit developer portal.",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_Gmail",
    label: "Gmail",
    description: "Search threads, manage labels, create drafts.",
    configHint: "Google OAuth (read + modify scope).",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_Indeed",
    label: "Indeed",
    description: "Search jobs, fetch job details and company data.",
    configHint: "Public scraping endpoint, no key required.",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_Microsoft_Learn",
    label: "Microsoft Learn",
    description: "Search Microsoft / Azure docs and code samples.",
    configHint: "Public; no auth required.",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_Recraft",
    label: "Recraft",
    description: "Generate, edit, upscale, and vectorize images.",
    configHint: "Recraft API key.",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_ZipRecruiter",
    label: "ZipRecruiter",
    description: "Search jobs across ZipRecruiter's listings.",
    configHint: "Public scraping endpoint, no key required.",
    defaultEnabled: false,
  },
  {
    id: "claude_ai_Google_Drive",
    label: "Google Drive",
    description: "Read and search files in your Drive.",
    configHint: "Google OAuth (drive.readonly).",
    defaultEnabled: false,
  },
  {
    id: "cli-microsoft365",
    label: "Microsoft 365 CLI",
    description: "Run CLI for Microsoft 365 commands and search docs.",
    configHint: "Local CLI for Microsoft 365 install + Microsoft 365 login.",
    defaultEnabled: false,
  },
];

export function getMcpCatalog(): McpCatalogEntry[] {
  return MCP_CATALOG;
}

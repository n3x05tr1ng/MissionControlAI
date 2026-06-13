"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import type { AgentProfile, PermissionMode } from "@/lib/contracts";
import type { ModelCatalogEntry } from "@/lib/settings";
import type { McpCatalogEntry } from "@/lib/mcp/catalog";
import {
  PROFILE_COLOR_SWATCHES,
  PROFILE_ICON_NAMES,
  ProfileIcon,
} from "@/components/icons/ProfileIcons";
import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";

const ALLOWED_TOOL_CHOICES = [
  "Read",
  "Edit",
  "Write",
  "Bash",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
] as const;

const PERMISSION_OPTIONS: Array<{
  value: PermissionMode;
  label: string;
  hint: string;
}> = [
  {
    value: "plan",
    label: "Plan",
    hint: "Read-only; agent proposes a plan but cannot modify files or run commands.",
  },
  {
    value: "default",
    label: "Default",
    hint: "Standard interactive mode; permission prompts on sensitive operations.",
  },
  {
    value: "acceptEdits",
    label: "Accept edits",
    hint: "Auto-accept file edits; still prompts for other sensitive tools.",
  },
  {
    value: "bypassPermissions",
    label: "Bypass",
    hint: "Skip all permission prompts. Use with caution.",
  },
];

/* ----------------------------- recetas de estilo ----------------------------- */

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-faint";
const labelClass = "text-xs font-medium text-muted-foreground";
const secondaryBtn =
  "h-9 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-50";

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="hive-card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

type Props = {
  profile: AgentProfile;
  models: ModelCatalogEntry[];
  mcpCatalog: McpCatalogEntry[];
};

export function ProfileEditor({ profile, models, mcpCatalog }: Props) {
  const router = useRouter();

  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(profile.systemPrompt ?? "");
  const [model, setModel] = useState(profile.model);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    profile.permissionMode,
  );
  const [icon, setIcon] = useState(profile.icon);
  const [color, setColor] = useState(profile.color);
  const [allowedTools, setAllowedTools] = useState<string[]>(
    profile.allowedTools,
  );
  const [mcpServers, setMcpServers] = useState<string[]>(profile.mcpServers);
  const [costCap, setCostCap] = useState<string>(
    profile.costCapUsd != null ? String(profile.costCapUsd) : "",
  );
  const [timeCap, setTimeCap] = useState<string>(
    profile.timeCapSeconds != null ? String(profile.timeCapSeconds) : "",
  );
  const [sandbox, setSandbox] = useState(profile.sandbox);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const modelOptions = useMemo(() => {
    if (models.length === 0)
      return [{ id: profile.model, label: profile.model, kind: "engine" as const }];
    return models;
  }, [models, profile.model]);

  function toggleTool(name: string) {
    setAllowedTools((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    );
  }

  function toggleMcp(id: string) {
    setMcpServers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  function buildPatch() {
    const costParsed = costCap.trim() === "" ? null : Number(costCap);
    const timeParsed = timeCap.trim() === "" ? null : Math.floor(Number(timeCap));
    return {
      name: name.trim(),
      description: description.trim() === "" ? null : description,
      systemPrompt: systemPrompt === "" ? null : systemPrompt,
      model,
      permissionMode,
      icon,
      color,
      allowedTools,
      mcpServers,
      costCapUsd:
        costParsed != null && Number.isFinite(costParsed) && costParsed > 0
          ? costParsed
          : null,
      timeCapSeconds:
        timeParsed != null && Number.isFinite(timeParsed) && timeParsed > 0
          ? timeParsed
          : null,
      sandbox,
    };
  }

  async function save() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatch()),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Request failed");
      }
      setOkMsg("Saved");
      notify.success("Profile saved");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profile.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Request failed");
      }
      const created = (await res.json()) as { id: string };
      router.push(`/profiles/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportProfile() {
    window.location.href = `/api/profiles/${profile.id}/export`;
  }

  async function destroy() {
    const ok = await confirm({
      title: "Delete profile",
      message: `Delete profile "${profile.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Request failed");
      }
      notify.success("Profile deleted");
      router.push("/profiles");
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera de página (patrón PageHeader + tile de identidad en vivo) */}
      <header className="animate-enter flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border"
            style={{
              color,
              borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            <ProfileIcon name={icon} size={24} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="hive-overline">[ PROFILE ]</p>
            <h1 className="hive-h1 truncate">{name || profile.name}</h1>
            <p className="font-mono text-[11px] text-faint">
              {profile.id}
              {profile.isTemplate ? " · template" : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {okMsg ? (
            <span className="text-xs font-medium text-success">{okMsg}</span>
          ) : null}
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
          <button
            type="button"
            onClick={duplicate}
            disabled={busy}
            className={secondaryBtn}
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={exportProfile}
            disabled={busy}
            className={secondaryBtn}
          >
            Export
          </button>
          <button
            type="button"
            onClick={destroy}
            disabled={busy}
            className="h-9 rounded-md border border-destructive/40 bg-destructive-soft px-3 text-[13px] font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-9 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        {/* Columna principal */}
        <div className="stagger-children flex flex-col gap-4 lg:col-span-3">
          <Section title="Identity">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What is this agent for?"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint"
              />
            </label>
          </Section>

          <Section
            title="System prompt"
            aside={
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-faint">
                  {systemPrompt.length} chars
                </span>
                <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface-2 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTab("edit")}
                    aria-pressed={tab === "edit"}
                    className={`rounded-xs px-2.5 py-0.5 text-xs font-medium ${
                      tab === "edit"
                        ? "bg-surface-3 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("preview")}
                    aria-pressed={tab === "preview"}
                    className={`rounded-xs px-2.5 py-0.5 text-xs font-medium ${
                      tab === "preview"
                        ? "bg-surface-3 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>
            }
          >
            {tab === "edit" ? (
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={14}
                placeholder="You are…"
                className="min-h-[20rem] rounded-md border border-input bg-background px-3 py-2 font-mono text-[12.5px] leading-relaxed text-foreground placeholder:text-faint"
              />
            ) : (
              <pre className="min-h-[20rem] whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-2 font-mono text-[12.5px] leading-relaxed text-muted-foreground">
                {systemPrompt || "(empty)"}
              </pre>
            )}
          </Section>

          <Section title="Permission mode">
            <div className="flex flex-col gap-2">
              {PERMISSION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-150 ${
                    permissionMode === opt.value
                      ? "border-primary/50 bg-primary-soft"
                      : "border-border hover:border-border-strong hover:bg-surface-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="permissionMode"
                    value={opt.value}
                    checked={permissionMode === opt.value}
                    onChange={() => setPermissionMode(opt.value)}
                    className="mt-1 accent-primary"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Section>
        </div>

        {/* Columna lateral */}
        <div className="stagger-children flex flex-col gap-4 lg:col-span-2">
          <Section title="Appearance">
            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Icon</span>
              <div className="grid grid-cols-5 gap-1.5">
                {PROFILE_ICON_NAMES.map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setIcon(n)}
                    aria-label={n}
                    aria-pressed={icon === n}
                    className={`flex h-10 items-center justify-center rounded-md border ${
                      icon === n
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:border-border-strong hover:bg-surface-2"
                    }`}
                    style={{ color }}
                  >
                    <ProfileIcon name={n} size={18} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Color</span>
              <div className="grid grid-cols-5 gap-1.5">
                {PROFILE_COLOR_SWATCHES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={c}
                    aria-pressed={color === c}
                    className={`h-8 rounded-md border border-border ${
                      color === c
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-surface-1"
                        : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </Section>

          <Section title="Model">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.id})
                </option>
              ))}
            </select>
          </Section>

          <Section title="Allowed tools">
            <div className="flex flex-wrap gap-1.5">
              {ALLOWED_TOOL_CHOICES.map((t) => {
                const on = allowedTools.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => toggleTool(t)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      on
                        ? "border-primary/40 bg-primary-soft text-primary"
                        : "border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="MCP servers">
            <div className="flex max-h-60 flex-col overflow-y-auto rounded-md border border-border">
              {mcpCatalog.map((m) => {
                const on = mcpServers.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-start gap-2.5 border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleMcp(m.id)}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13px] text-foreground">{m.label}</span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {m.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-faint">
              MCP runtime wiring is a stub in v0.3 — toggles persist but tools
              are not yet bound.
            </p>
          </Section>

          <Section title="Limits">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Cost cap (USD)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costCap}
                  placeholder="No cap"
                  onChange={(e) => setCostCap(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Time cap (seconds)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={timeCap}
                  placeholder="No cap"
                  onChange={(e) => setTimeCap(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 hover:bg-surface-2">
              <input
                type="checkbox"
                checked={sandbox}
                onChange={(e) => setSandbox(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-foreground">
                  Sandbox
                </span>
                <span className="text-xs text-muted-foreground">
                  Reserved for future per-profile sandboxing.
                </span>
              </span>
            </label>
          </Section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  AgentProfile,
  PermissionMode,
} from "@/lib/contracts";
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
    if (models.length === 0) return [{ id: profile.model, label: profile.model, kind: "engine" as const }];
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-hive-border pb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center border border-hive-border"
            style={{ color }}
          >
            <ProfileIcon name={icon} size={22} />
          </div>
          <div>
            <h1 className="font-sans text-lg text-hive-text">{name || profile.name}</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              {profile.id}
              {profile.isTemplate ? " · template" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {okMsg ? (
            <span className="font-mono text-[10px] text-green-400">{okMsg}</span>
          ) : null}
          {error ? (
            <span className="font-mono text-[10px] text-red-400">{error}</span>
          ) : null}
          <button
            type="button"
            onClick={duplicate}
            disabled={busy}
            className="border border-hive-border px-3 py-1 text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text disabled:opacity-50"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={exportProfile}
            disabled={busy}
            className="border border-hive-border px-3 py-1 text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text disabled:opacity-50"
          >
            Export
          </button>
          <button
            type="button"
            onClick={destroy}
            disabled={busy}
            className="border border-red-500/50 px-3 py-1 text-xs uppercase tracking-widest text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="border border-hive-amber bg-hive-amber/10 px-3 py-1 text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:opacity-50"
          >
            {busy ? "saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-3 lg:col-span-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
            />
          </label>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                System prompt
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-hive-muted">
                  {systemPrompt.length} chars
                </span>
                <div className="flex border border-hive-border">
                  <button
                    type="button"
                    onClick={() => setTab("edit")}
                    className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tab === "edit" ? "bg-hive-amber/20 text-hive-amber" : "text-hive-muted"}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("preview")}
                    className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest border-l border-hive-border ${tab === "preview" ? "bg-hive-amber/20 text-hive-amber" : "text-hive-muted"}`}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
            {tab === "edit" ? (
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={14}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-xs text-hive-text font-mono"
              />
            ) : (
              <pre className="bg-hive-bg border border-hive-border px-2 py-1 text-xs text-hive-text font-mono whitespace-pre-wrap min-h-[18rem]">
                {systemPrompt || "(empty)"}
              </pre>
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Model
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.id})
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Permission mode
            </span>
            <div className="flex flex-col gap-1">
              {PERMISSION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2 border px-2 py-1.5 cursor-pointer ${
                    permissionMode === opt.value
                      ? "border-hive-amber bg-hive-amber/10"
                      : "border-hive-border hover:border-hive-amber/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="permissionMode"
                    value={opt.value}
                    checked={permissionMode === opt.value}
                    onChange={() => setPermissionMode(opt.value)}
                    className="mt-0.5 accent-hive-amber"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm text-hive-text">{opt.label}</span>
                    <span className="text-xs text-hive-muted">{opt.hint}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Icon
            </span>
            <div className="grid grid-cols-5 gap-1">
              {PROFILE_ICON_NAMES.map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setIcon(n)}
                  className={`flex h-10 items-center justify-center border ${
                    icon === n
                      ? "border-hive-amber ring-1 ring-hive-amber"
                      : "border-hive-border hover:border-hive-amber/50"
                  }`}
                  style={{ color }}
                  aria-label={n}
                >
                  <ProfileIcon name={n} size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Color
            </span>
            <div className="grid grid-cols-5 gap-1">
              {PROFILE_COLOR_SWATCHES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 border ${
                    color === c
                      ? "border-hive-amber ring-1 ring-hive-amber"
                      : "border-hive-border"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Allowed tools
            </span>
            <div className="flex flex-wrap gap-1">
              {ALLOWED_TOOL_CHOICES.map((t) => {
                const on = allowedTools.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => toggleTool(t)}
                    className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${
                      on
                        ? "border-hive-amber bg-hive-amber/15 text-hive-amber"
                        : "border-hive-border text-hive-muted hover:text-hive-text"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              MCP servers
            </span>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border border-hive-border p-1">
              {mcpCatalog.map((m) => {
                const on = mcpServers.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-start gap-2 px-1.5 py-1 hover:bg-hive-bg/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleMcp(m.id)}
                      className="mt-0.5 accent-hive-amber"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs text-hive-text">{m.label}</span>
                      <span className="text-[10px] text-hive-muted">{m.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            <span className="font-mono text-[10px] text-hive-muted">
              MCP runtime wiring is a stub in v0.3 — toggles persist but tools are not yet bound.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Cost cap (USD)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costCap}
                placeholder="no cap"
                onChange={(e) => setCostCap(e.target.value)}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Time cap (seconds)
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={timeCap}
                placeholder="no cap"
                onChange={(e) => setTimeCap(e.target.value)}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 border border-hive-border px-2 py-2">
            <input
              type="checkbox"
              checked={sandbox}
              onChange={(e) => setSandbox(e.target.checked)}
              className="accent-hive-amber"
            />
            <div className="flex flex-col">
              <span className="text-sm text-hive-text">Sandbox</span>
              <span className="text-[10px] text-hive-muted">
                Reserved for future per-profile sandboxing.
              </span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

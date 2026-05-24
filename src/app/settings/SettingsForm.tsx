"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { notify } from "@/lib/ui/notify";

type ModelEntry = { id: string; label: string; kind: "engine" | "assistant" };

type McpCatalogEntry = {
  id: string;
  label: string;
  description: string;
  configHint: string;
  defaultEnabled: boolean;
};

type SectionKey =
  | "api_key"
  | "engine_provider"
  | "engine"
  | "assistant"
  | "catalog"
  | "scheduler"
  | "mcp";

type EngineProviderId = "claude-cli" | "claude-code";

export type SettingsInitial = {
  maskedKey: string | null;
  engineProvider: EngineProviderId;
  engineModel: string;
  assistantModel: string;
  autoNudgeAfterDays: number;
  modelsCatalog: ModelEntry[];
  enabledMcp: string[];
};

interface SettingsFormProps {
  initial: SettingsInitial;
  mcpCatalog: McpCatalogEntry[];
}

const inputClass =
  "bg-hive-panel border border-hive-border px-3 py-2 text-sm text-hive-text outline-none focus:border-hive-amber-dim";
const labelClass =
  "font-mono text-[11px] tracking-widest text-hive-muted uppercase";
const panelClass = "border border-hive-border bg-hive-panel p-4 space-y-3";
const buttonClass =
  "font-mono text-xs tracking-widest text-hive-amber border border-hive-border px-3 py-2 hover:border-hive-amber-dim disabled:opacity-40 disabled:cursor-not-allowed";

export function SettingsForm({ initial, mcpCatalog }: SettingsFormProps) {
  const [maskedKey, setMaskedKey] = useState<string | null>(initial.maskedKey);
  const [apiKey, setApiKey] = useState("");

  const [engineProvider, setEngineProvider] = useState<EngineProviderId>(
    initial.engineProvider,
  );
  const [cliStatus, setCliStatus] = useState<
    { ok: true; version: string } | { ok: false; error: string } | null
  >(null);

  const [catalog, setCatalog] = useState<ModelEntry[]>(initial.modelsCatalog);
  const [catalogText, setCatalogText] = useState(
    JSON.stringify(initial.modelsCatalog, null, 2),
  );

  const [engineModel, setEngineModel] = useState(initial.engineModel);
  const [assistantModel, setAssistantModel] = useState(initial.assistantModel);
  const [autoNudge, setAutoNudge] = useState<number>(initial.autoNudgeAfterDays);
  const [enabledMcp, setEnabledMcp] = useState<Set<string>>(
    new Set(initial.enabledMcp),
  );

  const [saving, setSaving] = useState<Record<SectionKey, boolean>>({
    api_key: false,
    engine_provider: false,
    engine: false,
    assistant: false,
    catalog: false,
    scheduler: false,
    mcp: false,
  });
  const [saved, setSaved] = useState<Record<SectionKey, boolean>>({
    api_key: false,
    engine_provider: false,
    engine: false,
    assistant: false,
    catalog: false,
    scheduler: false,
    mcp: false,
  });
  const [errors, setErrors] = useState<Record<SectionKey, string | null>>({
    api_key: null,
    engine_provider: null,
    engine: null,
    assistant: null,
    catalog: null,
    scheduler: null,
    mcp: null,
  });

  const engineOptions = useMemo(
    () => catalog.filter((m) => m.kind === "engine"),
    [catalog],
  );
  const assistantPool = useMemo(() => {
    const onlyAssistant = catalog.filter((m) => m.kind === "assistant");
    return onlyAssistant.length > 0 ? onlyAssistant : catalog;
  }, [catalog]);

  const flashSaved = (section: SectionKey): void => {
    setSaved((s) => ({ ...s, [section]: true }));
    window.setTimeout(() => {
      setSaved((s) => ({ ...s, [section]: false }));
    }, 2000);
  };

  async function postSetting(
    section: SectionKey,
    body: { key: string; value: unknown },
  ): Promise<boolean> {
    setSaving((s) => ({ ...s, [section]: true }));
    setErrors((e) => ({ ...e, [section]: null }));
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      flashSaved(section);
      notify.success("Saved");
      return true;
    } catch (err) {
      const msg = (err as Error).message;
      setErrors((e) => ({ ...e, [section]: msg }));
      notify.error(msg);
      return false;
    } finally {
      setSaving((s) => ({ ...s, [section]: false }));
    }
  }

  async function saveApiKey(): Promise<void> {
    if (apiKey.length === 0) return;
    const ok = await postSetting("api_key", {
      key: "anthropic_api_key",
      value: apiKey,
    });
    if (ok) {
      setApiKey("");
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { anthropic_api_key: string | null };
          setMaskedKey(data.anthropic_api_key);
        }
      } catch {
        // ignore — UI keeps prior masked key
      }
    }
  }

  async function saveEngine(): Promise<void> {
    if (engineModel.length === 0) return;
    await postSetting("engine", {
      key: "engine_default_model",
      value: engineModel,
    });
  }

  async function saveEngineProvider(next: EngineProviderId): Promise<void> {
    const prev = engineProvider;
    setEngineProvider(next);
    const ok = await postSetting("engine_provider", {
      key: "engine_provider",
      value: next,
    });
    if (!ok) setEngineProvider(prev);
  }

  async function saveAssistant(): Promise<void> {
    if (assistantModel.length === 0) return;
    await postSetting("assistant", {
      key: "assistant_default_model",
      value: assistantModel,
    });
  }

  async function saveCatalog(): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(catalogText);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        catalog: `Invalid JSON: ${(err as Error).message}`,
      }));
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setErrors((e) => ({
        ...e,
        catalog: "Catalog must be a non-empty array.",
      }));
      return;
    }
    const ok = await postSetting("catalog", {
      key: "models_catalog",
      value: parsed,
    });
    if (ok) setCatalog(parsed as ModelEntry[]);
  }

  async function saveScheduler(): Promise<void> {
    const n = Number(autoNudge);
    if (!Number.isFinite(n) || n < 1 || n > 90) {
      setErrors((e) => ({
        ...e,
        scheduler: "Value must be an integer between 1 and 90.",
      }));
      return;
    }
    await postSetting("scheduler", {
      key: "auto_nudge_after_days",
      value: Math.floor(n),
    });
  }

  // Debounced MCP save.
  const mcpTimer = useRef<number | null>(null);
  function toggleMcp(id: string, on: boolean): void {
    setEnabledMcp((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      if (mcpTimer.current !== null) window.clearTimeout(mcpTimer.current);
      mcpTimer.current = window.setTimeout(() => {
        void postSetting("mcp", {
          key: "mcp_servers_enabled",
          value: Array.from(next),
        });
      }, 300);
      return next;
    });
  }

  useEffect(() => {
    return () => {
      if (mcpTimer.current !== null) window.clearTimeout(mcpTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/system/claude-cli", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as
          | { ok: true; version: string }
          | { ok: false; error: string };
        if (!cancelled) setCliStatus(data);
      } catch (err) {
        if (!cancelled) {
          setCliStatus({ ok: false, error: (err as Error).message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <section className={panelClass}>
        <header className="flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
            API key
          </h2>
          <KeyStatusPill present={maskedKey !== null} />
        </header>
        <label htmlFor="anthropic_api_key" className={labelClass}>
          Anthropic API key (Assistant only)
        </label>
        <p className="text-[11px] text-hive-muted">
          Used ONLY by the Assistant chat (<code className="font-mono">/assistant</code>)
          for portfolio Q&amp;A. The Engine and Kanban tasks use your local
          Claude Code subscription via the <code className="font-mono">claude</code> CLI —
          no key needed.
        </p>
        <div className="flex items-center gap-2">
          <input
            id="anthropic_api_key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={maskedKey ?? "sk-ant-..."}
            className={`${inputClass} flex-1 font-mono`}
          />
          <button
            type="button"
            disabled={saving.api_key || apiKey.length === 0}
            onClick={() => void saveApiKey()}
            className={buttonClass}
          >
            {saving.api_key ? "SAVING…" : "SAVE"}
          </button>
          {saved.api_key && <SavedPill />}
        </div>
        {errors.api_key && (
          <p className="text-xs text-hive-red">{errors.api_key}</p>
        )}
      </section>

      <section className={panelClass}>
        <header className="flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
            Engine
          </h2>
          {saving.engine_provider && (
            <span className="font-mono text-[10px] tracking-widest text-hive-muted">
              SAVING…
            </span>
          )}
          {saved.engine_provider && <SavedPill />}
        </header>
        <p className="text-[11px] text-hive-muted">
          Which agent backend the Engine and Kanban tasks run on. Defaults to
          the local <code className="font-mono">claude</code> CLI so runs reuse
          your Claude Code subscription with no per-token billing.
        </p>
        <div className="space-y-2">
          <label className="flex items-start gap-3">
            <input
              type="radio"
              name="engine_provider"
              value="claude-cli"
              checked={engineProvider === "claude-cli"}
              onChange={() => void saveEngineProvider("claude-cli")}
              className="mt-1 accent-hive-amber"
            />
            <span className="flex-1">
              <span className="block text-sm text-hive-text">
                Subscription (claude CLI — free if you have Claude Code){" "}
                {cliStatus?.ok ? (
                  <span className="ml-1 font-mono text-[10px] text-hive-green">
                    ✓ {cliStatus.version}
                  </span>
                ) : cliStatus && !cliStatus.ok ? (
                  <span className="ml-1 font-mono text-[10px] text-hive-red">
                    not detected
                  </span>
                ) : null}
              </span>
              <span className="block text-[11px] text-hive-muted">
                Spawns the local <code className="font-mono">claude</code>{" "}
                binary as a headless PTY. Uses your existing auth.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="radio"
              name="engine_provider"
              value="claude-code"
              checked={engineProvider === "claude-code"}
              onChange={() => void saveEngineProvider("claude-code")}
              className="mt-1 accent-hive-amber"
            />
            <span className="flex-1">
              <span className="block text-sm text-hive-text">
                API key (Anthropic SDK — pay-per-token)
              </span>
              <span className="block text-[11px] text-hive-muted">
                Uses{" "}
                <code className="font-mono">@anthropic-ai/claude-agent-sdk</code>
                . Requires <code className="font-mono">anthropic_api_key</code>{" "}
                to be set above.
              </span>
            </span>
          </label>
        </div>
        {errors.engine_provider && (
          <p className="text-xs text-hive-red">{errors.engine_provider}</p>
        )}
      </section>

      <section className={panelClass}>
        <header>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
            Models
          </h2>
        </header>

        <div className="space-y-2">
          <label htmlFor="engine_default_model" className={labelClass}>
            Engine default model
          </label>
          <div className="flex items-center gap-2">
            <select
              id="engine_default_model"
              value={engineModel}
              onChange={(e) => setEngineModel(e.target.value)}
              className={`${inputClass} flex-1`}
            >
              <option value="">— select —</option>
              {engineOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.id})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving.engine || engineModel.length === 0}
              onClick={() => void saveEngine()}
              className={buttonClass}
            >
              {saving.engine ? "SAVING…" : "SAVE"}
            </button>
            {saved.engine && <SavedPill />}
          </div>
          {errors.engine && (
            <p className="text-xs text-hive-red">{errors.engine}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="assistant_default_model" className={labelClass}>
            Assistant model
          </label>
          <div className="flex items-center gap-2">
            <select
              id="assistant_default_model"
              value={assistantModel}
              onChange={(e) => setAssistantModel(e.target.value)}
              className={`${inputClass} flex-1`}
            >
              <option value="">— select —</option>
              {assistantPool.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.id})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving.assistant || assistantModel.length === 0}
              onClick={() => void saveAssistant()}
              className={buttonClass}
            >
              {saving.assistant ? "SAVING…" : "SAVE"}
            </button>
            {saved.assistant && <SavedPill />}
          </div>
          {errors.assistant && (
            <p className="text-xs text-hive-red">{errors.assistant}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="models_catalog" className={labelClass}>
            Models catalog (advanced)
          </label>
          <p className="text-[11px] text-hive-muted">
            Edit the list of models that show in the dropdowns above. JSON array
            of <code className="font-mono text-hive-amber">{`{id, label, kind}`}</code>{" "}
            where kind is <code className="font-mono">engine</code> or{" "}
            <code className="font-mono">assistant</code>.
          </p>
          <textarea
            id="models_catalog"
            value={catalogText}
            onChange={(e) => setCatalogText(e.target.value)}
            spellCheck={false}
            rows={8}
            className={`${inputClass} w-full font-mono text-xs`}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving.catalog}
              onClick={() => void saveCatalog()}
              className={buttonClass}
            >
              {saving.catalog ? "SAVING…" : "SAVE CATALOG"}
            </button>
            {saved.catalog && <SavedPill />}
          </div>
          {errors.catalog && (
            <p className="text-xs text-hive-red">{errors.catalog}</p>
          )}
        </div>
      </section>

      <section className={panelClass}>
        <header>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
            Scheduler
          </h2>
        </header>
        <label htmlFor="auto_nudge" className={labelClass}>
          Auto-nudge stale projects after N days
        </label>
        <div className="flex items-center gap-2">
          <input
            id="auto_nudge"
            type="number"
            min={1}
            max={90}
            value={autoNudge}
            onChange={(e) => setAutoNudge(Number(e.target.value))}
            className={`${inputClass} w-24 font-mono`}
          />
          <button
            type="button"
            disabled={saving.scheduler}
            onClick={() => void saveScheduler()}
            className={buttonClass}
          >
            {saving.scheduler ? "SAVING…" : "SAVE"}
          </button>
          {saved.scheduler && <SavedPill />}
        </div>
        {errors.scheduler && (
          <p className="text-xs text-hive-red">{errors.scheduler}</p>
        )}
      </section>

      <section className={panelClass}>
        <header className="flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
            MCP servers
          </h2>
          {saving.mcp && (
            <span className="font-mono text-[10px] tracking-widest text-hive-muted">
              SAVING…
            </span>
          )}
          {saved.mcp && <SavedPill />}
        </header>
        <p className="text-[11px] text-hive-muted">
          Toggle which MCP servers Hive should consider exposing to agent
          profiles. Saves automatically.
        </p>
        <ul className="divide-y divide-hive-border">
          {mcpCatalog.map((m) => {
            const on = enabledMcp.has(m.id);
            return (
              <li
                key={m.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <input
                  id={`mcp-${m.id}`}
                  type="checkbox"
                  checked={on}
                  onChange={(e) => toggleMcp(m.id, e.target.checked)}
                  className="mt-1 accent-hive-amber"
                />
                <label htmlFor={`mcp-${m.id}`} className="flex-1 cursor-pointer">
                  <span className="block text-sm text-hive-text">
                    {m.label}{" "}
                    <code className="font-mono text-[10px] text-hive-muted">
                      {m.id}
                    </code>
                  </span>
                  <span className="block text-[11px] text-hive-muted">
                    {m.description}
                  </span>
                  <span className="block text-[10px] text-hive-muted/70">
                    {m.configHint}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {errors.mcp && <p className="text-xs text-hive-red">{errors.mcp}</p>}
      </section>
    </div>
  );
}

function SavedPill() {
  return (
    <span className="font-mono text-[10px] tracking-widest text-hive-green border border-hive-border px-2 py-1">
      SAVED
    </span>
  );
}

function KeyStatusPill({ present }: { present: boolean }) {
  return (
    <span
      className={`font-mono text-[10px] tracking-widest border px-2 py-1 ${
        present
          ? "text-hive-green border-hive-border"
          : "text-hive-amber border-hive-border"
      }`}
    >
      {present ? "CONFIGURED" : "NOT CONFIGURED"}
    </span>
  );
}

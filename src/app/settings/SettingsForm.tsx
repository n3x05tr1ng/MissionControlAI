"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";

import { CatalogTable } from "./CatalogTable";
import { SectionNav, type SectionDef } from "./SectionNav";
import {
  Field,
  Select,
  SectionCard,
  StatusPill,
  Switch,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./controls";
import {
  ClockIcon,
  CpuIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  LayersIcon,
  PlugIcon,
  TableIcon,
} from "./icons";
import type {
  EngineProviderId,
  McpCatalogEntry,
  ModelEntry,
  SettingsInitial,
} from "./types";

export type { SettingsInitial } from "./types";

/* --------------------------------- secciones ------------------------------ */

const SECTIONS: SectionDef[] = [
  { id: "section-api-key", label: "API key", icon: <KeyIcon /> },
  { id: "section-engine", label: "Engine", icon: <CpuIcon /> },
  { id: "section-models", label: "Models", icon: <LayersIcon /> },
  { id: "section-catalog", label: "Model catalog", icon: <TableIcon /> },
  { id: "section-scheduler", label: "Scheduler", icon: <ClockIcon /> },
  { id: "section-mcp", label: "MCP servers", icon: <PlugIcon /> },
];

/* ------------------------------- estado/diff ------------------------------ */

type SettingKey =
  | "engine_provider"
  | "engine_default_model"
  | "assistant_default_model"
  | "auto_nudge_after_days"
  | "models_catalog"
  | "mcp_servers_enabled";

type Draft = {
  engineProvider: EngineProviderId;
  engineModel: string;
  assistantModel: string;
  /** Como string para no pelear con el input number; se valida al guardar. */
  autoNudge: string;
  catalog: ModelEntry[];
  enabledMcp: string[];
};

function draftFromInitial(initial: SettingsInitial): Draft {
  return {
    engineProvider: initial.engineProvider,
    engineModel: initial.engineModel,
    assistantModel: initial.assistantModel,
    autoNudge: String(initial.autoNudgeAfterDays),
    catalog: initial.modelsCatalog.map((m) => ({ ...m })),
    enabledMcp: [...initial.enabledMcp],
  };
}

function cloneDraft(d: Draft): Draft {
  return {
    ...d,
    catalog: d.catalog.map((m) => ({ ...m })),
    enabledMcp: [...d.enabledMcp],
  };
}

function normalizeCatalog(rows: ModelEntry[]): ModelEntry[] {
  return rows.map((r) => ({
    id: r.id.trim(),
    label: r.label.trim(),
    kind: r.kind,
  }));
}

function catalogEqual(a: ModelEntry[], b: ModelEntry[]): boolean {
  return (
    JSON.stringify(normalizeCatalog(a)) === JSON.stringify(normalizeCatalog(b))
  );
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

async function postSetting(
  key: string,
  value: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------------------------------- form ---------------------------------- */

interface SettingsFormProps {
  initial: SettingsInitial;
  mcpCatalog: McpCatalogEntry[];
}

export function SettingsForm({ initial, mcpCatalog }: SettingsFormProps) {
  /* ----- draft global + baseline (dirty = diff entre ambos) ----- */
  const [baseline, setBaseline] = useState<Draft>(() =>
    draftFromInitial(initial),
  );
  const [draft, setDraft] = useState<Draft>(() => draftFromInitial(initial));
  const [savingAll, setSavingAll] = useState(false);

  /* ----- API key (acción aparte: secreto write-only, nunca en el diff) ----- */
  const [maskedKey, setMaskedKey] = useState<string | null>(initial.maskedKey);
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const revealTimer = useRef<number | null>(null);

  /* ----- estado del claude CLI ----- */
  const [cliStatus, setCliStatus] = useState<
    { ok: true; version: string } | { ok: false; error: string } | null
  >(null);

  /* ----- scroll-spy ----- */
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  const dirty: Record<SettingKey, boolean> = useMemo(
    () => ({
      engine_provider: draft.engineProvider !== baseline.engineProvider,
      engine_default_model: draft.engineModel !== baseline.engineModel,
      assistant_default_model:
        draft.assistantModel !== baseline.assistantModel,
      auto_nudge_after_days:
        draft.autoNudge.trim() !== baseline.autoNudge.trim(),
      models_catalog: !catalogEqual(draft.catalog, baseline.catalog),
      mcp_servers_enabled: !sameSet(draft.enabledMcp, baseline.enabledMcp),
    }),
    [draft, baseline],
  );

  const dirtyKeys = useMemo(
    () => (Object.keys(dirty) as SettingKey[]).filter((k) => dirty[k]),
    [dirty],
  );

  const dirtySections = useMemo(() => {
    const s = new Set<string>();
    if (dirty.engine_provider) s.add("section-engine");
    if (dirty.engine_default_model || dirty.assistant_default_model)
      s.add("section-models");
    if (dirty.models_catalog) s.add("section-catalog");
    if (dirty.auto_nudge_after_days) s.add("section-scheduler");
    if (dirty.mcp_servers_enabled) s.add("section-mcp");
    return s;
  }, [dirty]);

  /* ----- validación en vivo (solo campos sucios) ----- */
  const validation = useMemo(() => {
    const v: Partial<Record<SettingKey, string>> = {};
    if (dirty.engine_default_model && draft.engineModel.trim() === "") {
      v.engine_default_model = "Select an engine model.";
    }
    if (dirty.assistant_default_model && draft.assistantModel.trim() === "") {
      v.assistant_default_model = "Select an assistant model.";
    }
    if (dirty.auto_nudge_after_days) {
      const n = Number(draft.autoNudge);
      if (!Number.isInteger(n) || n < 1 || n > 90) {
        v.auto_nudge_after_days = "Enter a whole number between 1 and 90.";
      }
    }
    if (dirty.models_catalog) {
      const rows = normalizeCatalog(draft.catalog);
      if (rows.length === 0) {
        v.models_catalog = "The catalog needs at least one model.";
      } else if (rows.some((r) => r.id === "" || r.label === "")) {
        v.models_catalog = "Every model needs an ID and a label.";
      } else if (new Set(rows.map((r) => r.id)).size !== rows.length) {
        v.models_catalog = "Model IDs must be unique.";
      }
    }
    return v;
  }, [dirty, draft]);

  const hasErrors = Object.keys(validation).length > 0;

  /* ----- opciones de los selects (siguen al catálogo editado en vivo) ----- */
  const engineOptions = useMemo(
    () => normalizeCatalog(draft.catalog).filter((m) => m.kind === "engine"),
    [draft.catalog],
  );
  const assistantOptions = useMemo(() => {
    const rows = normalizeCatalog(draft.catalog);
    const assistants = rows.filter((m) => m.kind === "assistant");
    return assistants.length > 0 ? assistants : rows;
  }, [draft.catalog]);

  /* --------------------------------- acciones ------------------------------ */

  const saveAll = useCallback(async (): Promise<void> => {
    if (savingAll || dirtyKeys.length === 0 || hasErrors) return;
    setSavingAll(true);

    const normalizedCatalog = normalizeCatalog(draft.catalog);
    const jobs: Array<{ key: SettingKey; value: unknown; label: string }> = [];
    // El catálogo primero: los modelos por defecto pueden depender de él.
    if (dirty.models_catalog) {
      jobs.push({
        key: "models_catalog",
        value: normalizedCatalog,
        label: "model catalog",
      });
    }
    if (dirty.engine_provider) {
      jobs.push({
        key: "engine_provider",
        value: draft.engineProvider,
        label: "engine provider",
      });
    }
    if (dirty.engine_default_model) {
      jobs.push({
        key: "engine_default_model",
        value: draft.engineModel,
        label: "engine model",
      });
    }
    if (dirty.assistant_default_model) {
      jobs.push({
        key: "assistant_default_model",
        value: draft.assistantModel,
        label: "assistant model",
      });
    }
    if (dirty.auto_nudge_after_days) {
      jobs.push({
        key: "auto_nudge_after_days",
        value: Math.floor(Number(draft.autoNudge)),
        label: "scheduler",
      });
    }
    if (dirty.mcp_servers_enabled) {
      jobs.push({
        key: "mcp_servers_enabled",
        value: draft.enabledMcp,
        label: "MCP servers",
      });
    }

    const failed: string[] = [];
    let catalogSaved = false;
    const nextBaseline = cloneDraft(baseline);
    for (const job of jobs) {
      const result = await postSetting(job.key, job.value);
      if (!result.ok) {
        failed.push(`${job.label} (${result.error})`);
        continue;
      }
      switch (job.key) {
        case "models_catalog":
          nextBaseline.catalog = normalizedCatalog.map((m) => ({ ...m }));
          catalogSaved = true;
          break;
        case "engine_provider":
          nextBaseline.engineProvider = draft.engineProvider;
          break;
        case "engine_default_model":
          nextBaseline.engineModel = draft.engineModel;
          break;
        case "assistant_default_model":
          nextBaseline.assistantModel = draft.assistantModel;
          break;
        case "auto_nudge_after_days":
          nextBaseline.autoNudge = String(Math.floor(Number(draft.autoNudge)));
          break;
        case "mcp_servers_enabled":
          nextBaseline.enabledMcp = [...draft.enabledMcp];
          break;
      }
    }

    setBaseline(nextBaseline);
    if (catalogSaved) {
      // Sincroniza el draft con las filas normalizadas (trim) ya persistidas.
      setDraft((d) => ({
        ...d,
        catalog: normalizedCatalog.map((m) => ({ ...m })),
      }));
    }
    setSavingAll(false);

    if (failed.length === 0) {
      notify.success("Settings saved");
    } else {
      notify.error(`Some settings failed to save — ${failed.join(" · ")}`);
    }
  }, [savingAll, dirtyKeys, hasErrors, dirty, draft, baseline]);

  const discardAll = useCallback((): void => {
    setDraft(cloneDraft(baseline));
  }, [baseline]);

  async function selectProvider(next: EngineProviderId): Promise<void> {
    if (next === draft.engineProvider) return;
    // Cambiar de proveedor afecta a TODOS los runs futuros: pedir confirmación
    // salvo que el usuario esté volviendo al valor ya guardado.
    if (next !== baseline.engineProvider) {
      const ok = await confirm({
        title: "Switch engine provider?",
        message:
          next === "claude-code"
            ? "All future Engine and Kanban runs will call the Anthropic API directly and bill per token. This requires the API key above. The change applies when you save."
            : "All future Engine and Kanban runs will spawn the local claude CLI and reuse your Claude Code subscription. The change applies when you save.",
        confirmLabel: "Switch provider",
      });
      if (!ok) return;
    }
    setDraft((d) => ({ ...d, engineProvider: next }));
  }

  function toggleMcp(id: string): void {
    setDraft((d) => {
      const has = d.enabledMcp.includes(id);
      return {
        ...d,
        enabledMcp: has
          ? d.enabledMcp.filter((x) => x !== id)
          : [...d.enabledMcp, id],
      };
    });
  }

  function toggleReveal(): void {
    if (revealTimer.current !== null) {
      window.clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    setReveal((prev) => {
      const next = !prev;
      if (next) {
        // Reveal momentáneo: se vuelve a enmascarar sola a los 5s.
        revealTimer.current = window.setTimeout(() => {
          setReveal(false);
          revealTimer.current = null;
        }, 5000);
      }
      return next;
    });
  }

  async function saveApiKey(): Promise<void> {
    const value = apiKey.trim();
    if (value.length === 0 || savingKey) return;
    setSavingKey(true);
    setKeyError(null);
    const result = await postSetting("anthropic_api_key", value);
    if (result.ok) {
      setApiKey("");
      setReveal(false);
      notify.success("API key saved");
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            anthropic_api_key: string | null;
          };
          setMaskedKey(data.anthropic_api_key);
        }
      } catch {
        // ignore — la UI conserva la máscara anterior
      }
    } else {
      setKeyError(result.error);
      notify.error(result.error);
    }
    setSavingKey(false);
  }

  function scrollToSection(id: string): void {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  /* --------------------------------- effects ------------------------------- */

  // Limpieza del timer de reveal.
  useEffect(() => {
    return () => {
      if (revealTimer.current !== null)
        window.clearTimeout(revealTimer.current);
    };
  }, []);

  // Detección del claude CLI.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/system/claude-cli", {
          cache: "no-store",
        });
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

  // Scroll-spy: la primera sección visible (en orden DOM) marca la nav.
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = SECTIONS.find((s) => visible.has(s.id));
        if (first) setActiveSection(first.id);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // ⌘S / Ctrl+S guarda los cambios pendientes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveAll();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAll]);

  /* --------------------------------- render -------------------------------- */

  const cliPill = cliStatus ? (
    cliStatus.ok ? (
      <StatusPill tone="success">
        v{cliStatus.version.replace(/^v/, "")}
      </StatusPill>
    ) : (
      <StatusPill tone="destructive">not detected</StatusPill>
    )
  ) : null;

  return (
    <div className="flex flex-col gap-6 pb-24 lg:flex-row lg:items-start lg:gap-10">
      {/* Nav móvil: pills horizontales pegadas arriba */}
      <div className="glass sticky top-0 z-30 -mx-2 rounded-lg px-2 py-1.5 lg:hidden">
        <SectionNav
          sections={SECTIONS}
          activeId={activeSection}
          dirtyIds={dirtySections}
          onSelect={scrollToSection}
          orientation="horizontal"
        />
      </div>

      {/* Nav de escritorio: rail sticky con scroll-spy */}
      <aside className="hidden w-48 shrink-0 lg:block">
        <div className="animate-enter sticky top-6">
          <SectionNav
            sections={SECTIONS}
            activeId={activeSection}
            dirtyIds={dirtySections}
            onSelect={scrollToSection}
          />
        </div>
      </aside>

      <div className="stagger-children flex min-w-0 flex-1 flex-col gap-5">
        {/* ------------------------------ API key ----------------------------- */}
        <SectionCard
          id="section-api-key"
          title="API key"
          description={
            <>
              Used only by the Assistant chat for portfolio Q&amp;A. Engine and
              Kanban runs use your local Claude Code subscription via the{" "}
              <code className="font-mono text-foreground/80">claude</code> CLI
              — no key needed there.
            </>
          }
          badge={
            maskedKey !== null ? (
              <StatusPill tone="success">configured</StatusPill>
            ) : (
              <StatusPill tone="warning">not configured</StatusPill>
            )
          }
        >
          <Field
            label="Anthropic API key"
            htmlFor="anthropic_api_key"
            hint={
              maskedKey !== null ? (
                <>
                  Current key:{" "}
                  <code className="font-mono text-foreground/80">
                    {maskedKey}
                  </code>
                  . Paste a new key to replace it.
                </>
              ) : (
                "Paste a key from the Anthropic Console to enable the Assistant."
              )
            }
            error={keyError}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <input
                  id="anthropic_api_key"
                  type={reveal ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-…"
                  className={`${inputClass} w-full pr-10 font-mono`}
                />
                <button
                  type="button"
                  onClick={toggleReveal}
                  aria-label={reveal ? "Hide key" : "Show key for 5 seconds"}
                  aria-pressed={reveal}
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-faint hover:bg-surface-2 hover:text-foreground"
                >
                  {reveal ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <button
                type="button"
                disabled={savingKey || apiKey.trim().length === 0}
                onClick={() => void saveApiKey()}
                className={primaryButtonClass}
              >
                {savingKey ? "Saving…" : "Save key"}
              </button>
            </div>
          </Field>
        </SectionCard>

        {/* ------------------------------ Engine ------------------------------ */}
        <SectionCard
          id="section-engine"
          title="Engine provider"
          description="Which agent backend the Engine and Kanban tasks run on. Switching affects all future runs."
        >
          <div
            role="radiogroup"
            aria-label="Engine provider"
            className="flex flex-col gap-2"
          >
            <ProviderCard
              value="claude-cli"
              selected={draft.engineProvider === "claude-cli"}
              onSelect={() => void selectProvider("claude-cli")}
              title="Subscription — claude CLI"
              pill={cliPill}
              description={
                <>
                  Spawns the local{" "}
                  <code className="font-mono text-foreground/70">claude</code>{" "}
                  binary as a headless PTY and reuses your existing Claude Code
                  auth. Free if you already have a subscription.
                </>
              }
            />
            <ProviderCard
              value="claude-code"
              selected={draft.engineProvider === "claude-code"}
              onSelect={() => void selectProvider("claude-code")}
              title="API key — Anthropic SDK"
              description={
                <>
                  Uses{" "}
                  <code className="font-mono text-foreground/70">
                    @anthropic-ai/claude-agent-sdk
                  </code>{" "}
                  and bills per token. Requires the API key above.
                </>
              }
            />
          </div>
        </SectionCard>

        {/* ------------------------------ Models ------------------------------ */}
        <SectionCard
          id="section-models"
          title="Default models"
          description="Which model each part of Hive picks by default. The options come from the model catalog below."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Engine model"
              htmlFor="engine_default_model"
              error={validation.engine_default_model ?? null}
            >
              <Select
                id="engine_default_model"
                value={draft.engineModel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, engineModel: e.target.value }))
                }
              >
                <option value="">Select a model…</option>
                {draft.engineModel !== "" &&
                !engineOptions.some((m) => m.id === draft.engineModel) ? (
                  <option value={draft.engineModel}>
                    {draft.engineModel} (not in catalog)
                  </option>
                ) : null}
                {engineOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.id})
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Assistant model"
              htmlFor="assistant_default_model"
              error={validation.assistant_default_model ?? null}
            >
              <Select
                id="assistant_default_model"
                value={draft.assistantModel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, assistantModel: e.target.value }))
                }
              >
                <option value="">Select a model…</option>
                {draft.assistantModel !== "" &&
                !assistantOptions.some(
                  (m) => m.id === draft.assistantModel,
                ) ? (
                  <option value={draft.assistantModel}>
                    {draft.assistantModel} (not in catalog)
                  </option>
                ) : null}
                {assistantOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.id})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </SectionCard>

        {/* --------------------------- Model catalog --------------------------- */}
        <SectionCard
          id="section-catalog"
          title="Model catalog"
          description={
            <>
              The models offered in the dropdowns above.{" "}
              <code className="font-mono text-foreground/70">kind</code>{" "}
              decides where a model appears: engine for runs, assistant for
              chat.
            </>
          }
        >
          <CatalogTable
            rows={draft.catalog}
            onChange={(rows) => setDraft((d) => ({ ...d, catalog: rows }))}
            error={validation.models_catalog ?? null}
          />
          {validation.models_catalog ? (
            <p className="mt-2 text-xs text-destructive">
              {validation.models_catalog}
            </p>
          ) : null}
        </SectionCard>

        {/* ----------------------------- Scheduler ----------------------------- */}
        <SectionCard
          id="section-scheduler"
          title="Scheduler"
          description="Background automation that keeps stale projects moving."
        >
          <Field
            label="Auto-nudge stale projects after"
            htmlFor="auto_nudge"
            error={validation.auto_nudge_after_days ?? null}
          >
            <div className="flex items-center gap-2">
              <input
                id="auto_nudge"
                type="number"
                min={1}
                max={90}
                inputMode="numeric"
                value={draft.autoNudge}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, autoNudge: e.target.value }))
                }
                className={`${inputClass} w-24 font-mono`}
              />
              <span className="text-[13px] text-muted-foreground">days</span>
            </div>
          </Field>
        </SectionCard>

        {/* ----------------------------- MCP servers ---------------------------- */}
        <SectionCard
          id="section-mcp"
          title="MCP servers"
          description="Which MCP servers Hive can expose to agent profiles. Changes apply when you save."
        >
          <ul className="divide-y divide-border">
            {mcpCatalog.map((m) => {
              const on = draft.enabledMcp.includes(m.id);
              return (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-2 text-sm text-foreground">
                      {m.label}
                      <code className="font-mono text-[11px] text-faint">
                        {m.id}
                      </code>
                    </p>
                    <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
                      {m.description}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-faint">
                      {m.configHint}
                    </p>
                  </div>
                  <Switch
                    checked={on}
                    onChange={() => toggleMcp(m.id)}
                    ariaLabel={`Enable ${m.label}`}
                  />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      {/* ---------------- barra flotante de cambios sin guardar ---------------- */}
      {dirtyKeys.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center pl-[264px] pr-6">
          <div
            role="status"
            aria-live="polite"
            className="glass animate-overlay pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-2.5 shadow-overlay"
          >
            <span
              aria-hidden="true"
              className="ai-pulse h-2 w-2 shrink-0 rounded-full bg-primary"
            />
            <p className="text-[13px] font-medium text-foreground">
              {dirtyKeys.length} unsaved{" "}
              {dirtyKeys.length === 1 ? "change" : "changes"}
            </p>
            {hasErrors ? (
              <p className="text-xs text-destructive">
                Fix the highlighted fields first
              </p>
            ) : (
              <span className="keycap hidden sm:inline-block">⌘S</span>
            )}
            <div className="ml-1 flex items-center gap-2">
              <button
                type="button"
                onClick={discardAll}
                disabled={savingAll}
                className={`${secondaryButtonClass} h-8`}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void saveAll()}
                disabled={savingAll || hasErrors}
                className={`${primaryButtonClass} h-8`}
              >
                {savingAll ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------- radio card de provider ------------------------ */

type ProviderCardProps = {
  value: EngineProviderId;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: React.ReactNode;
  pill?: React.ReactNode;
};

function ProviderCard({
  value,
  selected,
  onSelect,
  title,
  description,
  pill,
}: ProviderCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors duration-[120ms] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
        selected
          ? "border-primary/50 bg-primary-soft"
          : "border-border bg-background/40 hover:border-border-strong hover:bg-surface-2/60"
      }`}
    >
      <input
        type="radio"
        name="engine_provider"
        value={value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-[120ms] ${
          selected ? "border-primary" : "border-border-strong"
        }`}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          {title}
          {pill}
        </span>
        <span className="mt-1 block max-w-xl text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PROFILE_ICON_NAMES,
  ProfileIcon,
} from "@/components/icons/ProfileIcons";
import {
  createAutomation,
  createAutomationFromTemplate,
} from "@/components/automations/templateActions";
import type { Automation } from "@/lib/contracts";
import { notify } from "@/lib/ui/notify";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (automation: Automation) => void;
};

const COLORS = [
  "#f5a623",
  "#5cc8ff",
  "#a18cff",
  "#ff7a7a",
  "#7adda0",
  "#ffd166",
  "#9fa8b3",
];

const inputClass =
  "h-9 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground placeholder:text-faint";
const labelClass = "text-[12px] font-medium text-muted-foreground";

export function NewAutomationModal(props: Props) {
  if (!props.open) return null;
  // Re-mount on each open via key, so state resets naturally.
  return <NewAutomationModalInner key={String(props.open)} {...props} />;
}

function NewAutomationModalInner({ onClose, onCreated }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [icon, setIcon] = useState<string>("blueprint");
  const [templates, setTemplates] = useState<Automation[]>([]);
  const [templateId, setTemplateId] = useState<string>("blank");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plantillas reales desde la API (las hardcodeadas anteriores no clonaban).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Automation[]>) : []))
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setTemplates(list.filter((a) => a.isTemplate));
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape cierra (si no está creando).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function pickTemplate(id: string) {
    setTemplateId(id);
    if (id === "blank") return;
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    // Prefill útil sin pisar lo que el usuario ya escribió.
    if (!name.trim()) setName(t.name);
    if (!description.trim() && t.description) setDescription(t.description);
    setColor(t.color);
    setIcon(t.icon);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const template =
        templateId !== "blank"
          ? (templates.find((t) => t.id === templateId) ?? null)
          : null;

      const created = template
        ? await createAutomationFromTemplate(template, {
            name: name.trim(),
            description: description.trim() || null,
            color,
            icon,
          })
        : await createAutomation({
            name: name.trim(),
            description: description.trim() || null,
            color,
            icon,
          });

      notify.success("Automation created");
      if (onCreated) onCreated(created);
      onClose();
      router.push(`/automations/${created.id}`);
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="hive-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={() => !busy && onClose()}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-automation-title"
        className="glass animate-overlay flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl p-5 shadow-overlay"
      >
        <h2
          id="new-automation-title"
          className="text-[15px] font-semibold text-foreground"
        >
          New automation
        </h2>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Weekly changelog digest"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What does this pipeline do?"
            className="resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Color</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${
                  color === c
                    ? "scale-110 border-foreground"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Icon</span>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIcon(n)}
                className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                  icon === n
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
                aria-label={`Icon ${n}`}
                aria-pressed={icon === n}
              >
                <ProfileIcon name={n} size={16} />
              </button>
            ))}
          </div>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={labelClass}>Start from</legend>
          <div className="mt-1.5 flex flex-col gap-1.5">
            <TemplateOptionRow
              checked={templateId === "blank"}
              onSelect={() => pickTemplate("blank")}
              title="Blank"
              description="Start from scratch"
            />
            {templates.map((t) => (
              <TemplateOptionRow
                key={t.id}
                checked={templateId === t.id}
                onSelect={() => pickTemplate(t.id)}
                title={t.name}
                description={
                  t.description ??
                  `${t.steps.length} step${t.steps.length === 1 ? "" : "s"}`
                }
              />
            ))}
          </div>
        </fieldset>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive-soft px-2.5 py-1.5 text-[12px] text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create automation"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TemplateOptionRow({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 ${
        checked
          ? "border-primary/50 bg-primary-soft"
          : "border-border hover:bg-surface-2"
      }`}
    >
      <input
        type="radio"
        name="automation-template"
        checked={checked}
        onChange={onSelect}
        className="accent-primary"
      />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {title}
        </span>
        <span className="block truncate text-[12px] text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

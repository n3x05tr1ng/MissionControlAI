"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PROFILE_ICON_NAMES, ProfileIcon } from "@/components/icons/ProfileIcons";
import { notify } from "@/lib/ui/notify";
import type { Automation } from "@/lib/contracts";

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

type TemplateOption = {
  id: string;
  label: string;
  description: string;
};

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: "blank", label: "Blank", description: "Start from scratch" },
  {
    id: "content-pipeline",
    label: "Content Pipeline",
    description: "Researcher → Writer → Director review",
  },
  {
    id: "daily-standup",
    label: "Daily Project Standup",
    description: "Cross-project status summary",
  },
  {
    id: "bug-triage",
    label: "Bug Triage Loop",
    description: "Triage agent + reviewer loop",
  },
];

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
  const [template, setTemplate] = useState<string>("blank");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        color,
        icon,
      };
      if (description.trim()) body.description = description.trim();
      if (template !== "blank") body.fromTemplateId = template;

      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const created = (await res.json()) as Automation;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !busy && onClose()}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-hive-border bg-hive-panel p-5 flex flex-col gap-4"
      >
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ NEW AUTOMATION ]
        </h2>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-hive-bg border border-hive-border px-2 py-1.5 text-sm text-hive-text focus:border-hive-amber focus:outline-none"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Description (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="bg-hive-bg border border-hive-border px-2 py-1.5 text-sm text-hive-text resize-none focus:border-hive-amber focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Color
          </span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-6 w-6 border-2 transition-transform ${color === c ? "scale-110 border-hive-text" : "border-hive-border"}`}
                style={{ backgroundColor: c }}
                aria-label={`color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Icon
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIcon(n)}
                className={`flex h-8 w-8 items-center justify-center border transition-colors ${
                  icon === n
                    ? "border-hive-amber text-hive-amber"
                    : "border-hive-border text-hive-muted hover:text-hive-text"
                }`}
                aria-label={`icon ${n}`}
              >
                <ProfileIcon name={n} size={16} />
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Start from template
          </span>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="bg-hive-bg border border-hive-border px-2 py-1.5 text-sm text-hive-text focus:border-hive-amber focus:outline-none"
          >
            {TEMPLATE_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — {t.description}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <p className="font-mono text-[11px] text-red-400">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="border border-hive-border px-3 py-1 text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text"
          >
            cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="border border-hive-amber bg-hive-amber/10 px-3 py-1 text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:opacity-50"
          >
            {busy ? "creating…" : "create"}
          </button>
        </div>
      </form>
    </div>
  );
}

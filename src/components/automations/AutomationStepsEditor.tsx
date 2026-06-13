"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProfileIcon } from "@/components/icons/ProfileIcons";
import { confirm } from "@/components/ui/ConfirmDialog";
import type {
  AgentProfile,
  AutomationStep,
  AutomationStepType,
} from "@/lib/contracts";
import { notify } from "@/lib/ui/notify";

type Props = {
  automationId: string;
  initialSteps: AutomationStep[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

type DraftStep = AutomationStep & { _localOnly?: boolean };

const STEP_TYPE_OPTIONS: ReadonlyArray<{
  value: AutomationStepType;
  label: string;
}> = [
  { value: "agent", label: "Agent" },
  { value: "review_agent", label: "Review agent" },
  { value: "human_review", label: "Human review" },
];

// Chips de tipo de paso con tokens -soft (agent ámbar, review cian, human amarillo)
const STEP_TYPE_CHIP: Record<AutomationStepType, string> = {
  agent: "bg-primary-soft text-primary",
  review_agent: "bg-info-soft text-info",
  human_review: "bg-warning-soft text-warning",
};

const labelClass = "text-[12px] font-medium text-muted-foreground";
const fieldClass =
  "h-9 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground";

export function AutomationStepsEditor({ automationId, initialSteps }: Props) {
  const [steps, setSteps] = useState<DraftStep[]>(initialSteps);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Debounced patches keyed by stepId
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const pendingPatches = useRef<Map<string, Record<string, unknown>>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profiles?includeTemplates=true", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<AgentProfile[]>) : []))
      .then((list) => {
        if (!cancelled) setProfiles(list);
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const flushPatch = useCallback(
    async (stepId: string) => {
      const patch = pendingPatches.current.get(stepId);
      pendingPatches.current.delete(stepId);
      const timer = pendingTimers.current.get(stepId);
      if (timer) {
        clearTimeout(timer);
        pendingTimers.current.delete(stepId);
      }
      if (!patch || Object.keys(patch).length === 0) return;
      setSaveState("saving");
      try {
        const res = await fetch(
          `/api/automations/${automationId}/steps/${stepId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
      } catch (err) {
        setSaveState("error");
        notify.error(`Save failed: ${(err as Error).message}`);
      }
    },
    [automationId],
  );

  const queuePatch = useCallback(
    (stepId: string, patch: Record<string, unknown>) => {
      const existing = pendingPatches.current.get(stepId) ?? {};
      pendingPatches.current.set(stepId, { ...existing, ...patch });
      const prevTimer = pendingTimers.current.get(stepId);
      if (prevTimer) clearTimeout(prevTimer);
      const t = setTimeout(() => {
        void flushPatch(stepId);
      }, 500);
      pendingTimers.current.set(stepId, t);
    },
    [flushPatch],
  );

  // Flush all on unmount.
  useEffect(() => {
    const timersRef = pendingTimers.current;
    const patchesRef = pendingPatches.current;
    return () => {
      for (const [stepId] of patchesRef) {
        void flushPatch(stepId);
      }
      for (const t of timersRef.values()) clearTimeout(t);
    };
  }, [flushPatch]);

  const updateLocal = useCallback(
    (stepId: string, patch: Partial<AutomationStep>) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  async function addStep() {
    try {
      const res = await fetch(`/api/automations/${automationId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "agent" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // La API responde { ok, step }; tolera también el shape plano.
      const j = (await res.json()) as
        | { step?: AutomationStep }
        | AutomationStep;
      const created = ("step" in j && j.step ? j.step : j) as AutomationStep;
      if (!created?.id) throw new Error("Malformed response from API");
      setSteps((prev) => [...prev, created]);
      notify.success("Step added");
    } catch (err) {
      notify.error(`Add step failed: ${(err as Error).message}`);
    }
  }

  async function removeStep(stepId: string) {
    const ok = await confirm({
      title: "Delete step?",
      message: "This will remove the step from the automation.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(
        `/api/automations/${automationId}/steps/${stepId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
      notify.success("Step deleted");
    } catch (err) {
      notify.error(`Delete failed: ${(err as Error).message}`);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(steps, oldIndex, newIndex);
    setSteps(reordered);
    try {
      const res = await fetch(
        `/api/automations/${automationId}/steps/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      notify.error(`Reorder failed: ${(err as Error).message}`);
    }
  }

  return (
    <section className="animate-enter flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-foreground">Steps</h2>
        <SaveBadge state={saveState} />
      </div>

      {steps.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong bg-surface-1 p-6 text-center text-[13px] text-muted-foreground">
          No steps yet. Add the first one below.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col">
              {steps.map((step, idx) => (
                <SortableStepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  isLast={idx === steps.length - 1}
                  earlierSteps={steps.slice(0, idx)}
                  profiles={profiles}
                  onUpdateLocal={updateLocal}
                  onPatch={queuePatch}
                  onDelete={() => void removeStep(step.id)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={() => void addStep()}
        className="inline-flex h-9 items-center gap-1.5 self-start rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M7 2.5v9M2.5 7h9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Add step
      </button>
    </section>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const label =
    state === "saving" ? "saving…" : state === "saved" ? "saved" : "error";
  const color =
    state === "error"
      ? "text-destructive"
      : state === "saved"
        ? "text-success"
        : "text-faint";
  return <span className={`font-mono text-[11px] ${color}`}>{label}</span>;
}

type StepCardProps = {
  step: DraftStep;
  index: number;
  isLast: boolean;
  earlierSteps: DraftStep[];
  profiles: AgentProfile[];
  onUpdateLocal: (stepId: string, patch: Partial<AutomationStep>) => void;
  onPatch: (stepId: string, patch: Record<string, unknown>) => void;
  onDelete: () => void;
};

function SortableStepCard(props: StepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.step.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <StepCard {...props} dragHandle={{ ...attributes, ...listeners }} />
    </li>
  );
}

type StepCardInnerProps = StepCardProps & {
  dragHandle: React.HTMLAttributes<HTMLButtonElement>;
};

function StepCard({
  step,
  index,
  isLast,
  earlierSteps,
  profiles,
  onUpdateLocal,
  onPatch,
  onDelete,
  dragHandle,
}: StepCardInnerProps) {
  const profile = useMemo(
    () => profiles.find((p) => p.id === step.profileId) ?? null,
    [profiles, step.profileId],
  );

  function changeType(value: AutomationStepType) {
    onUpdateLocal(step.id, { type: value });
    onPatch(step.id, { type: value });
  }

  function changeProfile(id: string) {
    const v = id === "" ? null : id;
    onUpdateLocal(step.id, { profileId: v });
    onPatch(step.id, { profileId: v });
  }

  function changePrompt(value: string) {
    onUpdateLocal(step.id, { prompt: value });
    onPatch(step.id, { prompt: value });
  }

  function changeReviewsStep(id: string) {
    const v = id === "" ? null : id;
    onUpdateLocal(step.id, { reviewsStepId: v });
    onPatch(step.id, { reviewsStepId: v });
  }

  function changeMaxRetries(n: number) {
    const clamped = Math.max(1, Math.min(5, Math.floor(n) || 1));
    onUpdateLocal(step.id, { maxRetries: clamped });
    onPatch(step.id, { maxRetries: clamped });
  }

  function changeWaitForHuman(value: boolean) {
    onUpdateLocal(step.id, { waitForHuman: value });
    onPatch(step.id, { waitForHuman: value });
  }

  const chip = STEP_TYPE_CHIP[step.type] ?? STEP_TYPE_CHIP.agent;

  return (
    <div className={`flex gap-3 ${isLast ? "" : "pb-3"}`}>
      {/* Riel: número de paso + conector hairline hacia el siguiente */}
      <div className="flex flex-col items-center" aria-hidden="true">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-mono text-[11px] text-muted-foreground">
          {index + 1}
        </span>
        {isLast ? null : <span className="mt-1 w-px flex-1 bg-border" />}
      </div>

      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-bevel">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              {...dragHandle}
              className="cursor-grab rounded-xs px-1 font-mono text-[12px] text-faint hover:text-foreground"
              aria-label="Drag to reorder"
              title="Drag to reorder"
            >
              ⋮⋮
            </button>
            <span className="font-mono text-[11px] text-faint">
              Step {index + 1}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${chip}`}
            >
              {step.type.replace("_", " ")}
            </span>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="text-[12px] font-medium text-faint hover:text-destructive"
          >
            Delete
          </button>
        </header>

        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Type</span>
              <select
                value={step.type}
                onChange={(e) =>
                  changeType(e.target.value as AutomationStepType)
                }
                className={fieldClass}
              >
                {STEP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {step.type !== "human_review" ? (
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Profile</span>
                <div className="flex items-center gap-2">
                  {profile ? (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border"
                      style={{
                        color: profile.color,
                        background: `color-mix(in srgb, ${profile.color} 12%, transparent)`,
                      }}
                    >
                      <ProfileIcon name={profile.icon} size={16} />
                    </span>
                  ) : null}
                  <select
                    value={step.profileId ?? ""}
                    onChange={(e) => changeProfile(e.target.value)}
                    className={`flex-1 ${fieldClass}`}
                  >
                    <option value="">— select profile —</option>
                    <optgroup label="Templates">
                      {profiles
                        .filter((p) => p.isTemplate)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Custom">
                      {profiles
                        .filter((p) => !p.isTemplate)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
              </label>
            ) : null}
          </div>

          {step.type !== "human_review" ? (
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Prompt</span>
              <textarea
                value={step.prompt ?? ""}
                onChange={(e) => changePrompt(e.target.value)}
                rows={6}
                className="resize-y rounded-md border border-input bg-background px-2.5 py-2 font-mono text-xs leading-relaxed text-foreground placeholder:text-faint"
                placeholder={
                  step.type === "review_agent"
                    ? "Review the previous output. Reply APPROVE or REJECT: <reason>."
                    : "What should this agent do? Use {{step1.output}} to reference previous steps."
                }
              />
              <span className="font-mono text-[11px] text-faint">
                Use <code>{"{{stepN.output}}"}</code> to reference an earlier
                step.
              </span>
            </label>
          ) : null}

          {step.type === "review_agent" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Reviews step</span>
                <select
                  value={step.reviewsStepId ?? ""}
                  onChange={(e) => changeReviewsStep(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">— select step —</option>
                  {earlierSteps.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      Step {i + 1} ({s.type.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Max retries</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={step.maxRetries}
                  onChange={(e) => changeMaxRetries(Number(e.target.value))}
                  className={fieldClass}
                />
              </label>
            </div>
          ) : null}

          {step.type === "human_review" ? (
            <p className="rounded-md border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-[12px] text-warning">
              Run will pause and wait for your approval.
            </p>
          ) : null}

          {step.type !== "human_review" ? (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={step.waitForHuman}
                onChange={(e) => changeWaitForHuman(e.target.checked)}
                className="accent-primary"
              />
              <span>Pause for my approval after this step</span>
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}

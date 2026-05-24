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
      const created = (await res.json()) as AutomationStep;
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ STEPS ]
        </h2>
        <SaveBadge state={saveState} />
      </div>

      {steps.length === 0 ? (
        <p className="border border-hive-border bg-hive-panel p-4 text-sm text-hive-muted">
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
            <div className="flex flex-col gap-3">
              {steps.map((step, idx) => (
                <SortableStepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  earlierSteps={steps.slice(0, idx)}
                  profiles={profiles}
                  onUpdateLocal={updateLocal}
                  onPatch={queuePatch}
                  onDelete={() => void removeStep(step.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={() => void addStep()}
        className="self-start border border-hive-amber bg-hive-amber/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20"
      >
        + Add step
      </button>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const label =
    state === "saving" ? "saving…" : state === "saved" ? "saved" : "error";
  const color =
    state === "error" ? "text-red-400" : "text-hive-muted";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-widest ${color}`}>
      {label}
    </span>
  );
}

type StepCardProps = {
  step: DraftStep;
  index: number;
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
    <div ref={setNodeRef} style={style}>
      <StepCard {...props} dragHandle={{ ...attributes, ...listeners }} />
    </div>
  );
}

type StepCardInnerProps = StepCardProps & {
  dragHandle: React.HTMLAttributes<HTMLButtonElement>;
};

function StepCard({
  step,
  index,
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

  const typeColor =
    step.type === "review_agent"
      ? "text-hive-cyan border-hive-cyan/40"
      : step.type === "human_review"
        ? "text-yellow-300 border-yellow-300/40"
        : "text-hive-amber border-hive-amber/40";

  return (
    <div className="border border-hive-border bg-hive-panel">
      <header className="flex items-center justify-between gap-2 border-b border-hive-border bg-hive-bg/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...dragHandle}
            className="cursor-grab font-mono text-[11px] text-hive-muted hover:text-hive-text"
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            ⋮⋮
          </button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Step {index + 1}
          </span>
          <span
            className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${typeColor}`}
          >
            {step.type.replace("_", " ")}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-red-400"
        >
          Delete
        </button>
      </header>

      <div className="flex flex-col gap-3 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Type
            </span>
            <select
              value={step.type}
              onChange={(e) =>
                changeType(e.target.value as AutomationStepType)
              }
              className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
            >
              {STEP_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {step.type !== "human_review" ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Profile
              </span>
              <div className="flex items-center gap-2">
                {profile ? (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center border border-hive-border"
                    style={{ color: profile.color }}
                  >
                    <ProfileIcon name={profile.icon} size={16} />
                  </span>
                ) : null}
                <select
                  value={step.profileId ?? ""}
                  onChange={(e) => changeProfile(e.target.value)}
                  className="flex-1 bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
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
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Prompt
            </span>
            <textarea
              value={step.prompt ?? ""}
              onChange={(e) => changePrompt(e.target.value)}
              rows={6}
              className="bg-hive-bg border border-hive-border px-2 py-1.5 font-mono text-xs text-hive-text resize-y focus:border-hive-amber focus:outline-none"
              placeholder={
                step.type === "review_agent"
                  ? "Review the previous output. Reply APPROVE or REJECT: <reason>."
                  : "What should this agent do? Use {{step1.output}} to reference previous steps."
              }
            />
            <span className="font-mono text-[9px] text-hive-muted">
              Use <code>{"{{stepN.output}}"}</code> to reference an earlier
              step.
            </span>
          </label>
        ) : null}

        {step.type === "review_agent" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Reviews step
              </span>
              <select
                value={step.reviewsStepId ?? ""}
                onChange={(e) => changeReviewsStep(e.target.value)}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
              >
                <option value="">— select step —</option>
                {earlierSteps.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    Step {i + 1} ({s.type.replace("_", " ")})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Max retries
              </span>
              <input
                type="number"
                min={1}
                max={5}
                value={step.maxRetries}
                onChange={(e) => changeMaxRetries(Number(e.target.value))}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
              />
            </label>
          </div>
        ) : null}

        {step.type === "human_review" ? (
          <p className="rounded border border-yellow-300/30 bg-yellow-300/5 px-2 py-1.5 font-mono text-[11px] text-yellow-200">
            Run will pause and wait for your approval.
          </p>
        ) : null}

        {step.type !== "human_review" ? (
          <label className="flex items-center gap-2 text-xs text-hive-text/90">
            <input
              type="checkbox"
              checked={step.waitForHuman}
              onChange={(e) => changeWaitForHuman(e.target.checked)}
            />
            <span>Pause for my approval after this step</span>
          </label>
        ) : null}
      </div>
    </div>
  );
}

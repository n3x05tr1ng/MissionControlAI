"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { ProfileIcon } from "@/components/icons/ProfileIcons";
// Parallel teammate ships PathPicker; we import it eagerly. If at build time
// the module is missing we fall back to a plain input — see PathField below.
import { PathPicker } from "@/components/PathPicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { notify } from "@/lib/ui/notify";

import styles from "./welcome.module.css";

const TOTAL_STEPS = 5;

type Step = 1 | 2 | 3 | 4 | 5;

type Direction = "forward" | "backward";

type ProfileSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  model: string;
  allowedTools: string[];
  permissionMode: string;
  isTemplate: boolean;
};

const STEP_LABELS: ReadonlyArray<{ id: Step; label: string }> = [
  { id: 1, label: "Name" },
  { id: 2, label: "Tour" },
  { id: 3, label: "Project" },
  { id: 4, label: "API key" },
  { id: 5, label: "Profile" },
];

function basename(p: string): string {
  if (!p) return "";
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

async function finishOnboarding(): Promise<void> {
  try {
    await fetch("/api/onboarding/finish", { method: "POST" });
  } catch {
    // Idempotent; swallow. User can re-mark by reopening the flow.
  }
}

export function WelcomeWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<Direction>("forward");
  const [done, setDone] = useState<boolean>(false);

  // Step 1 (name) state
  const [userName, setUserNameInput] = useState<string>("");
  const [savingName, setSavingName] = useState<boolean>(false);

  // Step 3 (project) state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string>("");
  const [projectNameInput, setProjectNameInput] = useState<string>("");
  const [nameTouched, setNameTouched] = useState<boolean>(false);
  const projectName = nameTouched ? projectNameInput : basename(projectPath);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState<boolean>(false);

  // Step 4 (API key) state
  const [apiKey, setApiKey] = useState<string>("");
  const [apiKeySet, setApiKeySet] = useState<boolean>(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<boolean>(false);

  // Step 5 (profile gallery) state
  const [templates, setTemplates] = useState<ProfileSummary[] | null>(null);
  const [templatesFailed, setTemplatesFailed] = useState<boolean>(false);
  const [chosenProfile, setChosenProfile] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<boolean>(false);

  const advance = useCallback(() => {
    setDirection("forward");
    setStep((s) => (s < TOTAL_STEPS ? ((s + 1) as Step) : s));
  }, []);

  const back = useCallback(() => {
    setDirection("backward");
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }, []);

  const exitToDashboard = useCallback(async () => {
    await finishOnboarding();
    router.push("/");
    router.refresh();
  }, [router]);

  // ESC skips the whole wizard (disabled once we're celebrating/finishing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !done && !finishing) {
        void exitToDashboard();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitToDashboard, done, finishing]);

  // Profile templates are seeded at server start; load them once so step 5
  // shows the real gallery instead of a placeholder.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profiles")
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)),
      )
      .then((rows: ProfileSummary[]) => {
        if (cancelled) return;
        const onlyTemplates = rows.filter((p) => p.isTemplate);
        setTemplates(onlyTemplates.length > 0 ? onlyTemplates : rows);
      })
      .catch(() => {
        if (!cancelled) setTemplatesFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // After the celebration plays, land on the dashboard.
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 2200);
    return () => window.clearTimeout(t);
  }, [done, router]);

  async function saveUserName(): Promise<boolean> {
    const trimmed = userName.trim();
    // Empty name is allowed — defaults server-side to "friend".
    if (trimmed.length === 0) return true;
    setSavingName(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "user_name", value: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return true;
    } catch (err) {
      notify.error((err as Error).message);
      return false;
    } finally {
      setSavingName(false);
    }
  }

  async function createProject(): Promise<boolean> {
    if (!projectPath.trim()) {
      setProjectError("Pick a folder first.");
      return false;
    }
    if (!projectName.trim()) {
      setProjectError("Give the project a name.");
      return false;
    }
    setCreatingProject(true);
    setProjectError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          path: projectPath.trim(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const created = (await res.json()) as { id: string };
      setProjectId(created.id);
      notify.success("Project added");
      return true;
    } catch (err) {
      const msg = (err as Error).message;
      setProjectError(msg);
      notify.error(msg);
      return false;
    } finally {
      setCreatingProject(false);
    }
  }

  async function saveApiKey(): Promise<boolean> {
    if (!apiKey.trim()) {
      setKeyError("Paste a key or skip this step.");
      return false;
    }
    setSavingKey(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "anthropic_api_key", value: apiKey.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setApiKeySet(true);
      notify.success("API key saved");
      return true;
    } catch (err) {
      const msg = (err as Error).message;
      setKeyError(msg);
      notify.error(msg);
      return false;
    } finally {
      setSavingKey(false);
    }
  }

  async function finishSetup() {
    setFinishing(true);
    if (chosenProfile) {
      const picked = templates?.find((t) => t.id === chosenProfile);
      try {
        const res = await fetch(`/api/profiles/${chosenProfile}/duplicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newName: picked?.name }),
        });
        if (res.ok) notify.success("Profile added to your library");
      } catch {
        // Non-blocking: the template stays available on /profiles.
      }
    }
    await finishOnboarding();
    setFinishing(false);
    setDone(true);
  }

  const stepKey = done ? "done" : `step-${step}-${direction}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      {/* Atmosphere: aurora + noise. The wizard is a full-screen takeover, so
          the Shell's own aurora is hidden behind this opaque layer — we mount
          the shared utility locally at hero intensity. */}
      <div
        aria-hidden
        className="noise pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="shell-aurora" style={{ opacity: 0.3 }} />
        <div className="dot-grid absolute inset-x-0 top-0 h-72 opacity-60" />
      </div>

      <div className="relative flex min-h-full items-center justify-center p-4 py-10">
        <div className="flex w-full max-w-2xl flex-col gap-7">
          <Hero />

          {!done ? <ProgressRail step={step} /> : null}

          <section
            key={stepKey}
            aria-label={done ? "Setup complete" : `Setup step ${step} of ${TOTAL_STEPS}`}
            className={`relative min-h-[400px] overflow-hidden rounded-2xl border border-border bg-surface-1 p-8 shadow-bevel ${
              done
                ? "animate-overlay"
                : direction === "forward"
                  ? styles.stepForward
                  : styles.stepBack
            }`}
          >
            {done ? (
              <DoneView
                userName={userName.trim()}
                projectCreated={projectId !== null}
                apiKeySet={apiKeySet}
                profilePicked={chosenProfile !== null}
                onOpenNow={() => void exitToDashboard()}
              />
            ) : step === 1 ? (
              <StepName
                value={userName}
                saving={savingName}
                onChange={setUserNameInput}
                onNext={async () => {
                  const ok = await saveUserName();
                  if (ok) advance();
                }}
                onSkip={advance}
              />
            ) : step === 2 ? (
              <StepWelcome onNext={advance} />
            ) : step === 3 ? (
              <StepProject
                path={projectPath}
                name={projectName}
                error={projectError}
                loading={creatingProject}
                onPathChange={(p) => setProjectPath(p)}
                onNameChange={(n) => {
                  setNameTouched(true);
                  setProjectNameInput(n);
                }}
                onNext={async () => {
                  const ok = await createProject();
                  if (ok) advance();
                }}
                onSkip={advance}
              />
            ) : step === 4 ? (
              <StepApiKey
                value={apiKey}
                saved={apiKeySet}
                error={keyError}
                saving={savingKey}
                onChange={setApiKey}
                onSave={async () => {
                  const ok = await saveApiKey();
                  if (ok) advance();
                }}
                onSkip={advance}
              />
            ) : (
              <StepProfile
                templates={templates}
                failed={templatesFailed}
                selected={chosenProfile}
                finishing={finishing}
                onSelect={(id) =>
                  setChosenProfile((cur) => (cur === id ? null : id))
                }
                onFinish={() => void finishSetup()}
              />
            )}
          </section>

          {!done ? (
            <Footer
              step={step}
              onBack={back}
              onSkipAll={() => void exitToDashboard()}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- chrome ---------------------------------- */

function Hero() {
  return (
    <header className="animate-enter flex flex-col items-center gap-3 text-center">
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-8 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, var(--primary-soft), transparent)",
            filter: "blur(20px)",
          }}
        />
        <Image
          src="/hive-logo.svg"
          alt=""
          width={60}
          height={60}
          priority
          className={`relative ${styles.logoFloat}`}
        />
      </div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.32em] text-primary">
        Hive
      </p>
    </header>
  );
}

function ProgressRail({ step }: { step: Step }) {
  return (
    <nav aria-label="Setup progress" className="animate-enter px-1">
      <p className="sr-only">{`Step ${step} of ${TOTAL_STEPS}`}</p>
      <div className="relative">
        {/* Rail + animated fill (transform-only) */}
        <div
          aria-hidden
          className="absolute left-[10%] right-[10%] top-[5px] h-px bg-border-strong"
        />
        <div
          aria-hidden
          className="absolute left-[10%] right-[10%] top-[5px] h-px origin-left bg-primary"
          style={{
            transform: `scaleX(${(step - 1) / (TOTAL_STEPS - 1)})`,
            transition: "transform 280ms var(--ease-out)",
          }}
        />
        <ol className="relative grid grid-cols-5">
          {STEP_LABELS.map(({ id, label }) => {
            const state =
              id < step ? "done" : id === step ? "current" : "upcoming";
            return (
              <li
                key={id}
                aria-current={state === "current" ? "step" : undefined}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    state === "upcoming"
                      ? "border border-border-strong bg-surface-2"
                      : "bg-primary"
                  }`}
                  style={
                    state === "current"
                      ? { boxShadow: "0 0 0 4px var(--primary-soft)" }
                      : undefined
                  }
                />
                <span
                  className={`font-mono text-[11px] ${
                    state === "current"
                      ? "text-foreground"
                      : state === "done"
                        ? "text-muted-foreground"
                        : "text-faint"
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function Footer({
  step,
  onBack,
  onSkipAll,
}: {
  step: Step;
  onBack: () => void;
  onSkipAll: () => void;
}) {
  return (
    <div className="animate-enter flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={step === 1}
        className="h-8 rounded-md px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        ← Back
      </button>
      <button
        type="button"
        onClick={onSkipAll}
        className="flex h-8 items-center gap-2 rounded-md px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      >
        Skip setup
        <kbd className="keycap">esc</kbd>
      </button>
    </div>
  );
}

/* ----------------------------- shared bits -------------------------------- */

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-faint focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring";

const PRIMARY_BTN =
  "h-9 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:opacity-50 disabled:hover:shadow-none";

const GHOST_BTN =
  "h-9 rounded-md px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground";

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[12px] font-medium text-muted-foreground"
    >
      {children}
    </label>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

/* -------------------------------- steps ----------------------------------- */

function StepName({
  value,
  saving,
  onChange,
  onNext,
  onSkip,
}: {
  value: string;
  saving: boolean;
  onChange: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="What should I call you?"
        description="Hive greets you by name on the dashboard. You can change it anytime in Settings."
      />

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="welcome-name">Your name</FieldLabel>
        <input
          id="welcome-name"
          type="text"
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving) onNext();
          }}
          placeholder="Ada"
          className={INPUT_CLASS}
        />
      </div>

      <div className="mt-1 flex items-center gap-2">
        <button type="button" onClick={onNext} disabled={saving} className={PRIMARY_BTN}>
          {saving ? "Saving…" : "Continue"}
        </button>
        <button type="button" onClick={onSkip} className={GHOST_BTN}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

function FeatureIcon({ kind }: { kind: "folder" | "terminal" | "board" | "chat" }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "folder" ? (
        <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      ) : kind === "terminal" ? (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m7 9 3 3-3 3M13 15h4" />
        </>
      ) : kind === "board" ? (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M15 4v16" />
        </>
      ) : (
        <>
          <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
          <path d="M9 11h6M9 14h3" />
        </>
      )}
    </svg>
  );
}

const TOUR_FEATURES: ReadonlyArray<{
  icon: "folder" | "terminal" | "board" | "chat";
  text: string;
}> = [
  { icon: "folder", text: "Add projects from any folder on your disk." },
  { icon: "terminal", text: "Run Claude Code in an embedded terminal." },
  { icon: "board", text: "Queue tasks on a Kanban board shared across projects." },
  { icon: "chat", text: "Chat with an assistant that knows your whole portfolio." },
];

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Welcome to Hive"
        description="Your local-first command center for AI projects. Launch Claude Code runs, queue tasks, chat with an assistant that knows your portfolio, and get a nudge whenever something needs your attention — all from one window."
      />

      <ul className="stagger-children flex flex-col gap-2.5">
        {TOUR_FEATURES.map((f) => (
          <li key={f.icon} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
              <FeatureIcon kind={f.icon} />
            </span>
            <span className="text-sm text-foreground/90">{f.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-1">
        <button type="button" onClick={onNext} className={PRIMARY_BTN}>
          Get started
        </button>
      </div>
    </div>
  );
}

type PathFieldProps = {
  value: string;
  onChange: (p: string) => void;
};

function PathField({ value, onChange }: PathFieldProps) {
  // PathPicker is a client component shipped by a parallel teammate. We
  // import it eagerly above; if the module is unavailable at build time
  // the wizard degrades gracefully by rendering this plain input branch.
  const HasPicker = typeof PathPicker === "function";
  if (HasPicker) {
    return <PathPicker value={value} onChange={onChange} rootHint="home" />;
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="/absolute/path/to/your/project"
      className={`${INPUT_CLASS} font-mono`}
    />
  );
}

function StepProject({
  path,
  name,
  error,
  loading,
  onPathChange,
  onNameChange,
  onNext,
  onSkip,
}: {
  path: string;
  name: string;
  error: string | null;
  loading: boolean;
  onPathChange: (p: string) => void;
  onNameChange: (n: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Where does your code live?"
        description="Pick the folder of a project you want to manage from Hive. You can add more later from the dashboard."
      />

      <div className="flex flex-col gap-2">
        <FieldLabel>Folder</FieldLabel>
        <PathField value={path} onChange={onPathChange} />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="welcome-project-name">Project name</FieldLabel>
        <input
          id="welcome-project-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) onNext();
          }}
          placeholder="my-project"
          className={INPUT_CLASS}
        />
      </div>

      {error ? (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-1 flex items-center gap-2">
        <button type="button" onClick={onNext} disabled={loading} className={PRIMARY_BTN}>
          {loading ? "Adding…" : "Continue"}
        </button>
        <button type="button" onClick={onSkip} className={GHOST_BTN}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

function StepApiKey({
  value,
  saved,
  error,
  saving,
  onChange,
  onSave,
  onSkip,
}: {
  value: string;
  saved: boolean;
  error: string | null;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Connect your Anthropic account"
        description="Your key powers the Engine that runs Claude Code and the portfolio Assistant. It is stored locally in SQLite and never leaves your machine."
      />

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="welcome-api-key">Anthropic API key</FieldLabel>
        <input
          id="welcome-api-key"
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving) onSave();
          }}
          placeholder="sk-ant-…"
          autoComplete="off"
          className={`${INPUT_CLASS} font-mono`}
        />
        <p className="text-[12px] text-faint">
          Need one? Create a key in the{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Anthropic Console
          </a>
          .
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="inline-flex items-center gap-1.5 text-[12px] text-success">
          <CheckIcon size={14} />
          Key saved
        </p>
      ) : null}

      <div className="mt-1 flex items-center gap-2">
        <button type="button" onClick={onSave} disabled={saving} className={PRIMARY_BTN}>
          {saving ? "Saving…" : "Save and continue"}
        </button>
        <button type="button" onClick={onSkip} className={GHOST_BTN}>
          I&rsquo;ll add it later
        </button>
      </div>
    </div>
  );
}

function shortModel(model: string): string {
  // "claude-sonnet-4-5-20250929" → "sonnet-4-5"
  return model.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

function StepProfile({
  templates,
  failed,
  selected,
  finishing,
  onSelect,
  onFinish,
}: {
  templates: ProfileSummary[] | null;
  failed: boolean;
  selected: string | null;
  finishing: boolean;
  onSelect: (id: string) => void;
  onFinish: () => void;
}) {
  const loading = templates === null && !failed;
  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        title="Pick your first agent profile"
        description="Profiles are reusable agent configs — system prompt, tools, and permissions. Choose a starting point and Hive will add it to your library. You can skip and pick one later."
      />

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2" aria-hidden>
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
        </div>
      ) : failed || templates === null || templates.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-2/50 p-4">
          <p className="text-[13px] text-muted-foreground">
            Templates aren&rsquo;t available right now — your full profile
            gallery is waiting on the Profiles page after setup.
          </p>
        </div>
      ) : (
        <div
          role="group"
          aria-label="Agent profile templates"
          className="stagger-children grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
        >
          {templates.map((p) => {
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(p.id)}
                className={`flex flex-col gap-2 rounded-lg border p-3 text-left ${
                  isSelected
                    ? "border-primary/60 bg-primary-soft"
                    : "border-border bg-surface-2/50 hover:bg-surface-2"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{
                      color: p.color,
                      background: `color-mix(in oklab, ${p.color} 14%, transparent)`,
                    }}
                  >
                    <ProfileIcon name={p.icon} size={16} />
                  </span>
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {p.name}
                  </span>
                  {isSelected ? (
                    <span className="ml-auto text-primary">
                      <CheckIcon size={14} />
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                  {p.description ?? "No description."}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  {shortModel(p.model)} · {p.allowedTools.length} tools
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onFinish}
          disabled={finishing}
          className={PRIMARY_BTN}
        >
          {finishing
            ? "Finishing…"
            : selected
              ? "Use this profile and finish"
              : "Finish setup"}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- celebration -------------------------------- */

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12.5 5 5L19 7" />
    </svg>
  );
}

function SummaryRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex min-h-9 items-center justify-between gap-3 px-3">
      <span className="text-[13px] text-foreground/90">{label}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 font-mono text-[11px] text-success">
          <CheckIcon size={12} />
          done
        </span>
      ) : (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-faint">
          skipped
        </span>
      )}
    </li>
  );
}

function DoneView({
  userName,
  projectCreated,
  apiKeySet,
  profilePicked,
  onOpenNow,
}: {
  userName: string;
  projectCreated: boolean;
  apiKeySet: boolean;
  profilePicked: boolean;
  onOpenNow: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="relative mt-2 flex h-24 w-24 items-center justify-center">
        <div
          aria-hidden
          className={`absolute inset-0 rounded-full border border-primary ${styles.ringPing}`}
        />
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft ${styles.checkCircle}`}
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <svg
            width={40}
            height={40}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path className={styles.checkPath} d="m5 12.5 5 5L19 7" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          {userName ? `You're all set, ${userName}` : "You're all set"}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Opening your dashboard…
        </p>
      </div>

      <ul className="w-full max-w-sm divide-y divide-border rounded-lg border border-border bg-surface-2/40 py-1 text-left">
        <SummaryRow label="Name" ok={userName.length > 0} />
        <SummaryRow label="First project" ok={projectCreated} />
        <SummaryRow label="Anthropic API key" ok={apiKeySet} />
        <SummaryRow label="Agent profile" ok={profilePicked} />
      </ul>

      <button type="button" onClick={onOpenNow} className={GHOST_BTN}>
        Open dashboard now
      </button>
    </div>
  );
}

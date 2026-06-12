// Canonical types for Hive. Single source of truth (mirrors docs/plan/02-contracts.md).
// If anything here disagrees with that doc, fix the code, not the doc.

// ---------------------------------------------------------------------------
// 1. Project registry — projects.config.json
// ---------------------------------------------------------------------------

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  description?: string;
  sandbox?: boolean;
}

export interface ProjectsConfigFile {
  projects: ProjectConfig[];
}

// ---------------------------------------------------------------------------
// 2. Per-project state — .claude/state.json
// ---------------------------------------------------------------------------

export type ProjectStatus =
  | "idle"
  | "running"
  | "needs-input"
  | "blocked"
  | "done";

export type RunResult = "success" | "error";

export interface LastSession {
  id: string;
  endedAt: string;
  model: string;
  result: RunResult;
  costUsd: number;
  tokens: { input: number; output: number };
  filesTouched: string[];
}

export interface ProjectState {
  projectId: string;
  status: ProjectStatus;
  nextStep: string;
  blockers: string[];
  openQuestions: string[];
  lastSession: LastSession | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 3. Per-project handoff — .claude/handoff.md
// ---------------------------------------------------------------------------

export interface HandoffSections {
  doneThisSession: string | null;
  nextStep: string | null;
  blockers: string | null;
  openQuestions: string | null;
  filesTouched: string | null;
  contextForNextRun: string | null;
}

export interface ParsedHandoff {
  sections: HandoffSections;
  raw: string;
  parsedAt: string;
}

// ---------------------------------------------------------------------------
// 4. Git info
// ---------------------------------------------------------------------------

export interface GitInfo {
  branch: string;
  dirty: boolean;
  lastCommit: { hash: string; message: string; date: string } | null;
}

// ---------------------------------------------------------------------------
// 5. Aggregated read shape per project
// ---------------------------------------------------------------------------

export interface ProjectSnapshot {
  config: ProjectConfig;
  state: ProjectState;
  handoff: ParsedHandoff | null;
  git: GitInfo | null;
}

// ---------------------------------------------------------------------------
// 6. SQLite rows
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;
  project_id: string;
  profile_id: string | null;
  started_at: string;
  ended_at: string | null;
  model: string;
  result: RunResult | "running";
  cost_usd: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  prompt: string;
  flags: string; // JSON-stringified LaunchFlags
}

export interface ProjectIndexRow {
  project_id: string;
  status: ProjectStatus;
  next_step: string | null;
  last_session_at: string | null;
  git_branch: string | null;
  git_dirty: 0 | 1;
  indexed_at: string;
}

export type ReminderKind = "manual" | "auto-nudge";
export type ReminderStatus = "pending" | "fired" | "dismissed";

export interface ReminderRow {
  id: string;
  project_id: string | null;
  message: string;
  due_at: string;
  kind: ReminderKind;
  status: ReminderStatus;
  created_at: string;
}

export type NotificationType = "run-complete" | "reminder" | "nudge";

export interface NotificationRow {
  id: string;
  project_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  created_at: string;
}

export interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export type WorkflowTrigger = "manual" | "schedule" | "stale_days" | "on_session_end";

export interface WorkflowRow {
  id: string;
  name: string;
  source_path: string; // path to YAML
  trigger: WorkflowTrigger;
  cron: string | null;
  enabled: 0 | 1;
  created_at: string;
  updated_at: string;
}

export type WorkflowRunStatus = "pending" | "running" | "success" | "error";

export interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  started_at: string;
  ended_at: string | null;
  log: string; // JSON-stringified array of step results
  triggered_by: string; // "manual" | "schedule" | "system"
}

export type AssistantRole = "user" | "assistant" | "tool";

export interface AssistantMessageRow {
  id: string;
  conversation_id: string;
  role: AssistantRole;
  content: string; // JSON-stringified message content blocks
  created_at: string;
}

// ---------------------------------------------------------------------------
// 7. Launch flags (Prompt Composer → Engine)
// ---------------------------------------------------------------------------

export interface LaunchFlags {
  rawPrompt: string;
  finalPrompt: string;
  planMode: boolean;
  useSubagents: boolean;
  model: string;
  allowedTools: string[];
}

// ---------------------------------------------------------------------------
// 8. App config — app.config.json
// ---------------------------------------------------------------------------

export interface AppConfigModel {
  id: string;
  label: string;
  kind: "engine" | "assistant";
}

export interface AppConfig {
  models: AppConfigModel[];
  defaultEngineModel: string;
  assistantModel: string;
  autoNudgeAfterDays: number;
}

// ---------------------------------------------------------------------------
// 9. Agent provider interface — plugin contract
// ---------------------------------------------------------------------------

export interface AgentRunOptions {
  projectPath: string;
  flags: LaunchFlags;
  resumeSessionId?: string;
  profile?: AgentProfile;
  signal?: AbortSignal;
}

export type AgentEvent =
  | { type: "session.start"; sessionId: string; ts: string }
  | { type: "message"; role: "assistant" | "user"; text: string; ts: string }
  | { type: "tool.use"; name: string; input: unknown; ts: string }
  | { type: "tool.result"; name: string; output: unknown; ts: string }
  | {
      type: "session.end";
      sessionId: string;
      result: RunResult;
      costUsd: number;
      tokens: { input: number; output: number };
      filesTouched: string[];
      ts: string;
    }
  | { type: "error"; message: string; ts: string; sessionId?: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string; ts: string };

export interface AgentProvider {
  id: string;
  label: string;
  run(opts: AgentRunOptions): AsyncIterable<AgentEvent>;
}

// ---------------------------------------------------------------------------
// 10. Workflow YAML
// ---------------------------------------------------------------------------

export type WorkflowOn = "manual" | { stale_days: number } | "on_session_end";

export interface WorkflowStepShell {
  id: string;
  run: string;
  in?: "project" | "hive";
  projectId?: string;
}

export interface WorkflowStepAgent {
  id: string;
  agent: string; // provider id (e.g. "claude-code")
  projectId: string;
  prompt: string;
  flags?: Partial<LaunchFlags>;
}

export type WorkflowStep = WorkflowStepShell | WorkflowStepAgent;

export function isAgentStep(step: WorkflowStep): step is WorkflowStepAgent {
  return "agent" in step;
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  on?: WorkflowOn;
  schedule?: string; // cron
  steps: WorkflowStep[];
}

// ---------------------------------------------------------------------------
// 11. Tasks (Kanban board) — multi-agent unit of work
// ---------------------------------------------------------------------------

export const TASK_STATUSES = [
  "backlog",
  "ready",
  "running",
  "review",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  prompt: string;
  agent_id: string;
  profile_id: string;
  status: TaskStatus;
  sort_order: number;
  session_id: string | null;
  flags: string | null; // JSON-stringified Partial<LaunchFlags>
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  schedule: string | null; // cron expression, null = one-shot
  next_run_at: string | null; // ISO timestamp of next scheduled instance
  recurring_template: 0 | 1; // 1 = template that spawns instances
  parent_template_id: string | null; // FK to the template that spawned this instance
}

// ---------------------------------------------------------------------------
// 11. Agent profiles
// ---------------------------------------------------------------------------

export type PermissionMode =
  | "plan"
  | "default"
  | "acceptEdits"
  | "bypassPermissions";

export interface AgentProfileRow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  system_prompt: string | null;
  model: string;
  allowed_tools: string; // JSON array
  mcp_servers: string; // JSON array
  permission_mode: PermissionMode;
  cost_cap_usd: number | null;
  time_cap_seconds: number | null;
  sandbox: 0 | 1;
  is_template: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  systemPrompt: string | null;
  model: string;
  allowedTools: string[];
  mcpServers: string[];
  permissionMode: PermissionMode;
  costCapUsd: number | null;
  timeCapSeconds: number | null;
  sandbox: boolean;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 12. Automations — multi-step agent pipelines (cross-project)
// ---------------------------------------------------------------------------

export type AutomationStepType = "agent" | "review_agent" | "human_review";
export type AutomationRunStatus =
  | "pending"
  | "running"
  | "awaiting_human"
  | "done"
  | "error";
export type AutomationEventStatus =
  | "running"
  | "success"
  | "rejected"
  | "awaiting_human"
  | "error";
export type ReviewVerdict = "approve" | "reject";
export type AutomationTriggeredBy = "manual" | "schedule" | "system";

export interface AutomationRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  schedule: string | null;
  next_run_at: string | null;
  enabled: 0 | 1;
  is_template: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface AutomationStepRow {
  id: string;
  automation_id: string;
  step_order: number;
  step_type: AutomationStepType;
  profile_id: string | null;
  prompt: string | null;
  reviews_step_id: string | null;
  max_retries: number;
  wait_for_human: 0 | 1;
  created_at: string;
}

export interface AutomationRunRow {
  id: string;
  automation_id: string;
  status: AutomationRunStatus;
  current_step_id: string | null;
  context: string;
  started_at: string;
  ended_at: string | null;
  triggered_by: AutomationTriggeredBy;
  error: string | null;
  final_output: string | null;
}

export interface AutomationRunEventRow {
  id: string;
  run_id: string;
  step_id: string;
  attempt: number;
  status: AutomationEventStatus;
  agent_output: string | null;
  review_verdict: ReviewVerdict | null;
  review_feedback: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface AutomationStep {
  id: string;
  automationId: string;
  order: number;
  type: AutomationStepType;
  profileId: string | null;
  prompt: string | null;
  reviewsStepId: string | null;
  maxRetries: number;
  waitForHuman: boolean;
}

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  schedule: string | null;
  nextRunAt: string | null;
  enabled: boolean;
  isTemplate: boolean;
  steps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRunEvent {
  id: string;
  runId: string;
  stepId: string;
  attempt: number;
  status: AutomationEventStatus;
  agentOutput: string | null;
  reviewVerdict: ReviewVerdict | null;
  reviewFeedback: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  status: AutomationRunStatus;
  currentStepId: string | null;
  context: Record<string, string>;
  startedAt: string;
  endedAt: string | null;
  triggeredBy: AutomationTriggeredBy;
  error: string | null;
  finalOutput: string | null;
  events: AutomationRunEvent[];
}

export type AutomationEvent =
  | {
      type: "automation.run.started";
      runId: string;
      automationId: string;
    }
  | {
      type: "automation.run.step.started";
      runId: string;
      stepId: string;
      attempt: number;
    }
  | {
      type: "automation.run.step.output";
      runId: string;
      stepId: string;
      attempt: number;
      partial: string;
    }
  | {
      type: "automation.run.step.completed";
      runId: string;
      stepId: string;
      attempt: number;
      verdict?: ReviewVerdict;
    }
  | {
      type: "automation.run.awaiting_human";
      runId: string;
      stepId: string;
    }
  | {
      type: "automation.run.done";
      runId: string;
      finalOutput: string;
    }
  | {
      type: "automation.run.error";
      runId: string;
      message: string;
    };

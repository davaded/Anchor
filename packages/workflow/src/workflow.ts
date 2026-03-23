import path from "node:path";
import { AnchorRuntimeEngine } from "@anchor/core";
import type { GoalCore, TaskInspection, TaskReplayView, TerminalResult } from "@anchor/core";
import { createWorkflowServices } from "./service";

export type WorkflowBackend = "codex" | "claude";

export interface GoalWorkflowRunOptions {
  backend: WorkflowBackend;
  target?: string;
  goal?: string;
  cwd?: string;
  constraints?: string[];
  success?: string[];
  stateDir?: string;
  maxRounds?: number;
  maxSameFailure?: number;
  allowPartial?: boolean;
}

export interface GoalSkillRequest {
  goal_skill_id: string;
  target: string;
  resolved_goal: string;
  scope_assumptions: string[];
  constraints: string[];
  success_criteria: string[];
  cwd: string;
}

const defaultGoalConstraints = [
  "Preserve validated behavior outside the active target slice.",
  "Do not expand into unrelated modules unless the broader scope is justified."
];

const defaultGoalSuccessCriteria = [
  "The requested target is materially advanced or completed.",
  "Trusted execution evidence supports the returned state.",
  "No unintended scope expansion is introduced."
];

function normalizeTargetText(value?: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "current work";
}

function resolveGoalPrompt(target: string) {
  if (target === "current work") {
    return "Continue the current implementation work in this repository and make meaningful progress on the active in-flight task.";
  }

  return `Advance the requested implementation target in this repository: ${target}.`;
}

function uniqueText(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];
}

export function resolveWorkflowCwd(cwd?: string) {
  return path.resolve(cwd ?? process.cwd());
}

export function resolveGoalTarget(options: Pick<GoalWorkflowRunOptions, "target" | "goal">) {
  return normalizeTargetText(options.target ?? options.goal);
}

export function createGoalSkillRequest(options: GoalWorkflowRunOptions): GoalSkillRequest {
  const target = resolveGoalTarget(options);
  const cwd = resolveWorkflowCwd(options.cwd);

  return {
    goal_skill_id: `goal_skill:${target}`,
    target,
    resolved_goal: resolveGoalPrompt(target),
    scope_assumptions: [
      "Use the current workspace as the execution root unless a narrower slice becomes clearer.",
      target === "current work"
        ? "Target resolution is based on the active workspace context."
        : `Treat "${target}" as the active implementation target.`
    ],
    constraints: uniqueText([...defaultGoalConstraints, ...(options.constraints ?? [])]),
    success_criteria: uniqueText(
      options.success?.length
        ? options.success
        : [
            target === "current work"
              ? "The active in-flight repository work is materially advanced."
              : `The requested target "${target}" is materially advanced or completed.`,
            ...defaultGoalSuccessCriteria
          ]
    ),
    cwd
  };
}

export function createWorkflowGoal(options: GoalWorkflowRunOptions): GoalCore {
  const skillRequest = createGoalSkillRequest(options);

  return AnchorRuntimeEngine.materializeGoal({
    goal: skillRequest.resolved_goal,
    constraints: skillRequest.constraints,
    success_criteria: skillRequest.success_criteria,
    cwd: skillRequest.cwd,
    stop_policy: {
      max_rounds: options.maxRounds ?? 6,
      max_same_failure: options.maxSameFailure ?? 2,
      allow_partial: options.allowPartial ?? true
    }
  });
}

export async function runGoalWorkflow(options: GoalWorkflowRunOptions): Promise<TerminalResult> {
  const services = createWorkflowServices(options.stateDir);
  const goal = createWorkflowGoal(options);
  return services.runtime.run({
    backend_id: options.backend,
    goal
  });
}

export async function runWorkflow(options: GoalWorkflowRunOptions): Promise<TerminalResult> {
  return runGoalWorkflow(options);
}

export async function resumeWorkflow(taskId: string, backend: WorkflowBackend, stateDir?: string) {
  const services = createWorkflowServices(stateDir);
  return services.runtime.resume({
    task_id: taskId,
    backend_id: backend
  });
}

export async function inspectWorkflow(taskId: string, stateDir?: string): Promise<TaskInspection> {
  const services = createWorkflowServices(stateDir);
  return services.runtime.inspect(taskId);
}

export async function replayWorkflow(taskId: string, stateDir?: string): Promise<TaskReplayView> {
  const services = createWorkflowServices(stateDir);
  return services.runtime.replay(taskId);
}

export async function doctorWorkflows(stateDir?: string) {
  const services = createWorkflowServices(stateDir);
  return Promise.all(Object.values(services.adapters).map((adapter) => adapter.doctor()));
}

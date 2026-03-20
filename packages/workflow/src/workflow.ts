import { AnchorRuntimeEngine } from "@anchor/core";
import type { GoalCore, TaskInspection, TaskReplayView, TerminalResult } from "@anchor/core";
import { createWorkflowServices } from "./service";

export interface WorkflowRunOptions {
  backend: "codex" | "claude";
  goal: string;
  cwd?: string;
  constraints?: string[];
  success?: string[];
  stateDir?: string;
  maxRounds?: number;
  maxSameFailure?: number;
  allowPartial?: boolean;
}

export function createWorkflowGoal(options: WorkflowRunOptions): GoalCore {
  return AnchorRuntimeEngine.materializeGoal({
    goal: options.goal,
    constraints: options.constraints ?? [],
    success_criteria: options.success ?? ["The requested goal is satisfied.", "Trusted execution evidence supports the returned state."],
    cwd: options.cwd,
    stop_policy: {
      max_rounds: options.maxRounds ?? 6,
      max_same_failure: options.maxSameFailure ?? 2,
      allow_partial: options.allowPartial ?? true
    }
  });
}

export async function runWorkflow(options: WorkflowRunOptions): Promise<TerminalResult> {
  const services = createWorkflowServices(options.stateDir);
  const goal = createWorkflowGoal(options);
  return services.runtime.run({
    backend_id: options.backend,
    goal
  });
}

export async function resumeWorkflow(taskId: string, backend: "codex" | "claude", stateDir?: string) {
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

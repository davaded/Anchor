import { z } from "zod";

export const runtimeStateValues = [
  "idle",
  "ready",
  "dispatching",
  "awaiting_backend",
  "evaluating",
  "updating_memory",
  "deciding",
  "completed",
  "partial",
  "stopped",
  "errored"
] as const;

export const terminalReasonValues = [
  "success",
  "partial_returned",
  "manual_stop",
  "severe_loop",
  "hard_constraint_violation",
  "runtime_error",
  "budget_exhausted",
  "max_rounds_reached",
  "max_same_failure_reached",
  "backend_blocked",
  "interrupted_unknown_completion"
] as const;

export const stopTriggerValues = [
  "manual_stop_requested",
  "runtime_error_detected",
  "hard_constraint_violation_detected",
  "max_rounds_reached",
  "max_same_failure_reached",
  "budget_exhausted",
  "severe_loop_detected",
  "return_partial_requested",
  "success_detected",
  "interrupted_unknown_completion_detected"
] as const;

export const strategyValues = [
  "retry_same",
  "patch",
  "rewrite_local",
  "decompose",
  "change_method",
  "stop",
  "return_partial"
] as const;

export const backendStatusValues = [
  "completed",
  "failed",
  "blocked",
  "timed_out",
  "interrupted"
] as const;

export const roundLifecycleValues = [
  "constructed",
  "dispatched",
  "running",
  "completed",
  "failed",
  "timed_out",
  "interrupted",
  "rejected"
] as const;

export const severityValues = ["low", "medium", "high"] as const;
export const failureTypeValues = ["missing", "invalid", "misaligned", "superficial", "regressive", "stuck"] as const;
export const loopLevelValues = ["none", "mild", "severe"] as const;
export const trustTierValues = ["trusted", "derived", "self_reported"] as const;
export const artifactTypeValues = ["transcript", "patch", "command-log", "evaluation-report", "report", "other"] as const;
export const validatedFactKindValues = ["constraint_satisfied", "behavior_validated", "regression_absent", "artifact_verified"] as const;
export const eventTypeValues = ["goal_started", "round_built", "round_dispatched", "backend_result_recorded", "evaluation_recorded", "decision_recorded", "task_completed", "task_partially_returned", "task_stopped", "task_errored"] as const;

export const RuntimeStateSchema = z.enum(runtimeStateValues);
export const TerminalReasonSchema = z.enum(terminalReasonValues);
export const StopTriggerSchema = z.enum(stopTriggerValues);
export const StrategySchema = z.enum(strategyValues);
export const BackendStatusSchema = z.enum(backendStatusValues);
export const RoundLifecycleSchema = z.enum(roundLifecycleValues);
export const SeveritySchema = z.enum(severityValues);
export const FailureTypeSchema = z.enum(failureTypeValues);
export const LoopLevelSchema = z.enum(loopLevelValues);
export const TrustTierSchema = z.enum(trustTierValues);
export const ArtifactTypeSchema = z.enum(artifactTypeValues);
export const ValidatedFactKindSchema = z.enum(validatedFactKindValues);
export const EventTypeSchema = z.enum(eventTypeValues);

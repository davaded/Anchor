import type { BackendResult, EvaluationResult, ProjectionSnapshot, RoundInput, ValidatedFact } from "../types";
import { createValidatedFactId, nowIso } from "./ids";
import { buildFailureFingerprint, determineScope, fingerprintKey } from "./helpers";

function deriveFailedChecks(result: BackendResult): EvaluationResult["failed_checks"] {
  const failedChecks: EvaluationResult["failed_checks"] = [];

  if (result.status === "blocked") {
    failedChecks.push({
      type: "invalid",
      code: "BACKEND_BLOCKED",
      detail: "Backend reported a blocking condition.",
      trust_tier: "trusted"
    });
  }

  if (result.status === "timed_out") {
    failedChecks.push({
      type: "stuck",
      code: "BACKEND_TIMEOUT",
      detail: "Backend execution timed out.",
      trust_tier: "trusted"
    });
  }

  if (result.status === "interrupted") {
    failedChecks.push({
      type: "stuck",
      code: "BACKEND_INTERRUPTED",
      detail: "Backend execution was interrupted or could not be confirmed.",
      trust_tier: "trusted"
    });
  }

  if (result.trusted.process_exit_code !== undefined && result.trusted.process_exit_code !== null && result.trusted.process_exit_code !== 0) {
    failedChecks.push({
      type: "invalid",
      code: "PROCESS_EXIT_NON_ZERO",
      detail: `Backend exited with code ${result.trusted.process_exit_code}.`,
      trust_tier: "trusted"
    });
  }

  for (const command of result.derived.commands) {
    if (command.status !== "completed") {
      failedChecks.push({
        type: "invalid",
        code: "COMMAND_FAILURE",
        detail: `Command "${command.command}" finished with status ${command.status}.`,
        trust_tier: command.trust_tier
      });
    }
  }

  for (const blocker of result.derived.blockers) {
    failedChecks.push({
      type: blocker.retryable ? "stuck" : "invalid",
      code: blocker.code,
      detail: blocker.detail,
      trust_tier: blocker.trust_tier
    });
  }

  for (const violation of result.derived.constraint_violations) {
    failedChecks.push({
      type: "invalid",
      code: "CONSTRAINT_VIOLATION",
      detail: violation,
      trust_tier: "derived"
    });
  }

  return failedChecks;
}

function deriveValidatedFacts(taskId: string, roundId: string, resolvedChecks: string[]): ValidatedFact[] {
  return resolvedChecks.map((statement) => ({
    id: createValidatedFactId(),
    task_id: taskId,
    round_id: roundId,
    kind: "behavior_validated",
    statement,
    confidence: "medium",
    still_valid: true
  }));
}

export function evaluateRound(input: {
  snapshot: ProjectionSnapshot;
  round: RoundInput;
  result: BackendResult;
}): EvaluationResult {
  const failedChecks = deriveFailedChecks(input.result);
  const resolvedChecks: string[] = [];
  const regressions: string[] = [];

  if (
    input.result.status === "completed" &&
    input.result.trusted.process_exit_code === 0 &&
    input.result.derived.commands.every((command) => command.status === "completed") &&
    input.result.derived.constraint_violations.length === 0
  ) {
    resolvedChecks.push("Backend execution completed without trusted command failures.");
  }

  const hardConstraintViolation = failedChecks.some((item) => item.code === "CONSTRAINT_VIOLATION");
  const scope = determineScope(input.result.derived.files);
  const failureFingerprint = buildFailureFingerprint(failedChecks, scope);
  const key = fingerprintKey(failureFingerprint);
  const existing = input.snapshot.failure_patterns.find((pattern) => pattern.fingerprint_key === key);
  const repeatedCount = existing ? existing.seen_count + 1 : failedChecks.length > 0 ? 1 : 0;

  const loopLevel =
    repeatedCount >= 3 ||
    (repeatedCount >= 2 && regressions.length > 0)
      ? "severe"
      : repeatedCount >= 2
        ? "mild"
        : "none";

  const pass = failedChecks.length === 0 && input.result.status === "completed" && input.result.trusted.process_exit_code === 0;
  const severity =
    hardConstraintViolation || input.result.status === "blocked" || input.result.status === "timed_out"
      ? "high"
      : failedChecks.length > 0
        ? "medium"
        : "low";

  return {
    task_id: input.snapshot.task.task_id,
    goal_id: input.snapshot.task.goal.goal_id,
    round_id: input.round.round_id,
    pass,
    failed_checks: failedChecks,
    resolved_checks: resolvedChecks,
    regressions,
    severity,
    evaluation_summary: pass
      ? "Trusted execution completed without detected failures."
      : input.result.self_reported.summary || failedChecks[0]?.detail || "Execution did not satisfy the current round requirements.",
    failure_fingerprint: failureFingerprint,
    repeated_fingerprint_count: repeatedCount,
    loop_state: {
      loop_level: loopLevel,
      evidence:
        loopLevel === "none"
          ? []
          : [
              `Failure fingerprint repeated ${repeatedCount} time(s).`,
              `Scope classified as ${scope}.`
            ],
      repeat_count: repeatedCount,
      active_fingerprint_key: failedChecks.length > 0 ? key : undefined
    },
    validated_facts: deriveValidatedFacts(input.snapshot.task.task_id, input.round.round_id, resolvedChecks),
    invalidated_fact_ids: [],
    hard_constraint_violation: hardConstraintViolation
  };
}

export function createInterruptedRecoveryResult(round: RoundInput, backend: BackendResult["backend"]): BackendResult {
  const timestamp = nowIso();
  return {
    task_id: round.task_id,
    goal_id: round.goal_id,
    round_id: round.round_id,
    backend,
    status: "interrupted",
    trusted: {
      started_at: timestamp,
      finished_at: timestamp,
      duration_ms: 0,
      execution_confirmed: false,
      process_exit_code: null
    },
    derived: {
      files: [],
      commands: [],
      blockers: [
        {
          code: "UNKNOWN_COMPLETION",
          detail: "Runtime resumed after an in-flight round without a confirmed backend result.",
          retryable: true,
          trust_tier: "trusted"
        }
      ],
      constraint_violations: []
    },
    self_reported: {
      summary: "Recovered interrupted round with unknown completion.",
      notes: [],
      claims: []
    },
    artifacts: []
  };
}

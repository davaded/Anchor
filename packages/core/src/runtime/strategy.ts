import type { EvaluationResult, ProjectionSnapshot, RoundInput, StrategyDecision, TerminalResult } from "../types";
import { nowIso } from "./ids";

function terminalDecision(
  snapshot: ProjectionSnapshot,
  round: RoundInput,
  decision: StrategyDecision["decision"],
  reason: string,
  terminalReason: StrategyDecision["terminal_reason"],
  stopTrigger: StrategyDecision["stop_trigger"]
): StrategyDecision {
  return {
    task_id: snapshot.task.task_id,
    goal_id: snapshot.task.goal.goal_id,
    round_id: round.round_id,
    decision,
    reason,
    terminal_reason: terminalReason,
    stop_trigger: stopTrigger,
    next_instructions: []
  };
}

export function decideNextStep(snapshot: ProjectionSnapshot, round: RoundInput, evaluation: EvaluationResult): StrategyDecision {
  const stopPolicy = snapshot.task.goal.stop_policy;

  if (evaluation.hard_constraint_violation) {
    return terminalDecision(snapshot, round, "stop", "Hard constraint violation detected.", "hard_constraint_violation", "hard_constraint_violation_detected");
  }

  if (evaluation.pass) {
    return terminalDecision(snapshot, round, "stop", "Success criteria satisfied by trusted execution evidence.", "success", "success_detected");
  }

  if (evaluation.loop_state.loop_level === "severe") {
    return terminalDecision(
      snapshot,
      round,
      stopPolicy.allow_partial ? "return_partial" : "stop",
      "Severe loop detected.",
      stopPolicy.allow_partial ? "partial_returned" : "severe_loop",
      "severe_loop_detected"
    );
  }

  if (round.round_id === `round_${stopPolicy.max_rounds}`) {
    return terminalDecision(
      snapshot,
      round,
      stopPolicy.allow_partial ? "return_partial" : "stop",
      "Maximum rounds reached.",
      stopPolicy.allow_partial ? "partial_returned" : "max_rounds_reached",
      "max_rounds_reached"
    );
  }

  if (evaluation.repeated_fingerprint_count >= stopPolicy.max_same_failure) {
    return terminalDecision(
      snapshot,
      round,
      stopPolicy.allow_partial ? "return_partial" : "stop",
      "Repeated failure threshold reached.",
      stopPolicy.allow_partial ? "partial_returned" : "max_same_failure_reached",
      "max_same_failure_reached"
    );
  }

  const scopeToken = evaluation.failure_fingerprint.find((item) => item.startsWith("scope:"));
  const scope = scopeToken?.replace("scope:", "") ?? "medium";
  const failureCodes = new Set(evaluation.failed_checks.map((item) => item.code));

  if (failureCodes.has("UNKNOWN_COMPLETION") || failureCodes.has("BACKEND_INTERRUPTED")) {
    return {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      round_id: round.round_id,
      decision: "change_method",
      reason: "In-flight round completion is unknown; switch method before retrying.",
      next_strategy: "change_method",
      next_instructions: ["Re-dispatch the task with a fresh backend attempt and preserve ledger history."]
    };
  }

  if (scope === "narrow" && evaluation.repeated_fingerprint_count >= 2) {
    return {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      round_id: round.round_id,
      decision: "rewrite_local",
      reason: "Narrow failure repeated across rounds.",
      next_strategy: "rewrite_local",
      next_instructions: ["Rewrite the local failure slice while preserving validated behavior elsewhere."]
    };
  }

  if (scope === "broad") {
    return {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      round_id: round.round_id,
      decision: "decompose",
      reason: "Failure scope is broad; decompose into a smaller slice.",
      next_strategy: "decompose",
      next_instructions: ["Reduce the task scope and retry against a smaller slice."]
    };
  }

  if (failureCodes.has("BACKEND_BLOCKED")) {
    return {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      round_id: round.round_id,
      decision: "change_method",
      reason: "Backend reported a blocking condition.",
      next_strategy: "change_method",
      next_instructions: ["Adjust execution method before retrying."]
    };
  }

  if (evaluation.failed_checks.length === 1 && evaluation.severity === "low") {
    return {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      round_id: round.round_id,
      decision: "retry_same",
      reason: "Single low-severity failure detected.",
      next_strategy: "retry_same",
      next_instructions: ["Retry the same round once with the same strategy."]
    };
  }

  return {
    task_id: snapshot.task.task_id,
    goal_id: snapshot.task.goal.goal_id,
    round_id: round.round_id,
    decision: "patch",
    reason: "Localized failures remain; patch the explicit failed checks.",
    next_strategy: "patch",
    next_instructions: ["Fix only the explicit failed checks from the previous round."]
  };
}

export function toTerminalResult(snapshot: ProjectionSnapshot, decision: StrategyDecision, evaluation: EvaluationResult): TerminalResult {
  const summary = decision.reason || evaluation.evaluation_summary || snapshot.task.best_known_state.summary;
  return {
    task_id: snapshot.task.task_id,
    goal_id: snapshot.task.goal.goal_id,
    terminal_reason: decision.terminal_reason ?? "runtime_error",
    stop_trigger: decision.stop_trigger,
    summary,
    best_known_state: {
      summary,
      validated_items: [
        ...snapshot.validated_facts.filter((item) => item.still_valid).map((item) => item.statement),
        ...evaluation.validated_facts.map((item) => item.statement)
      ],
      unresolved_items: evaluation.failed_checks.map((item) => item.detail),
      last_meaningful_round: evaluation.round_id
    },
    completed_at: nowIso()
  };
}

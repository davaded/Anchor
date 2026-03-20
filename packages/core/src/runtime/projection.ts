import type { AnchorEvent, ProjectionSnapshot } from "../types";

function ensureStrategyStat(snapshot: ProjectionSnapshot, strategy: ProjectionSnapshot["task"]["current_strategy"]) {
  if (!strategy) return;
  let stat = snapshot.strategy_stats.find((item) => item.strategy === strategy);
  if (!stat) {
    stat = {
      task_id: snapshot.task.task_id,
      strategy,
      attempts: 0,
      passes: 0,
      partials: 0,
      stop_caused: 0,
      repeated_failure_count: 0
    };
    snapshot.strategy_stats.push(stat);
  }
  return stat;
}

function fingerprintKey(fingerprint: string[]): string {
  return fingerprint.join("|");
}

export function applyEvent(snapshot: ProjectionSnapshot | null, event: AnchorEvent): ProjectionSnapshot {
  if (event.type === "goal_started") {
    return {
      task: {
        task_id: event.task_id,
        goal: event.payload.goal,
        backend_id: event.payload.backend_id,
        runtime_state: "ready",
        created_at: event.occurred_at,
        updated_at: event.occurred_at,
        current_strategy: "patch",
        best_known_state: {
          summary: event.payload.goal.goal,
          validated_items: [],
          unresolved_items: event.payload.goal.success_criteria
        },
        loop_state: {
          loop_level: "none",
          evidence: [],
          repeat_count: 0
        }
      },
      rounds: [],
      failure_patterns: [],
      validated_facts: [],
      strategy_stats: [],
      artifacts: []
    };
  }

  if (!snapshot) {
    throw new Error("Projection snapshot cannot be null for non-goal_started events.");
  }

  switch (event.type) {
    case "round_built": {
      snapshot.rounds.push({
        task_id: event.task_id,
        goal_id: event.goal_id,
        round_id: event.payload.round.round_id,
        ordinal: Number(event.payload.round.round_id.replace("round_", "")),
        strategy: event.payload.round.strategy,
        task_slice: event.payload.round.task_slice,
        instructions: event.payload.round.instructions,
        lifecycle: "constructed",
        created_at: event.occurred_at,
        updated_at: event.occurred_at
      });
      snapshot.task.runtime_state = "dispatching";
      snapshot.task.active_round_id = event.payload.round.round_id;
      snapshot.task.current_strategy = event.payload.round.strategy;
      snapshot.task.updated_at = event.occurred_at;
      const stat = ensureStrategyStat(snapshot, event.payload.round.strategy);
      if (stat) {
        stat.attempts += 1;
        stat.last_used_round = event.payload.round.round_id;
      }
      return snapshot;
    }
    case "round_dispatched": {
      const round = snapshot.rounds.find((item) => item.round_id === event.payload.round_id);
      if (round) {
        round.lifecycle = "dispatched";
        round.updated_at = event.occurred_at;
      }
      snapshot.task.runtime_state = "awaiting_backend";
      snapshot.task.updated_at = event.occurred_at;
      return snapshot;
    }
    case "backend_result_recorded": {
      const round = snapshot.rounds.find((item) => item.round_id === event.payload.result.round_id);
      if (round) {
        round.backend_result = event.payload.result;
        round.lifecycle =
          event.payload.result.status === "completed"
            ? "completed"
            : event.payload.result.status === "timed_out"
              ? "timed_out"
              : event.payload.result.status === "interrupted"
                ? "interrupted"
                : "failed";
        round.updated_at = event.occurred_at;
      }
      snapshot.task.runtime_state = "evaluating";
      snapshot.task.updated_at = event.occurred_at;
      return snapshot;
    }
    case "evaluation_recorded": {
      const round = snapshot.rounds.find((item) => item.round_id === event.payload.evaluation.round_id);
      if (round) {
        round.evaluation = event.payload.evaluation;
        round.updated_at = event.occurred_at;
      }
      snapshot.task.runtime_state = "updating_memory";
      snapshot.task.loop_state = event.payload.evaluation.loop_state;
      snapshot.task.best_known_state = {
        summary: event.payload.evaluation.evaluation_summary,
        validated_items: [
          ...snapshot.validated_facts.filter((item) => item.still_valid).map((item) => item.statement),
          ...event.payload.evaluation.validated_facts.map((item) => item.statement)
        ],
        unresolved_items: event.payload.evaluation.failed_checks.map((item) => item.detail),
        last_meaningful_round: event.payload.evaluation.round_id
      };

      for (const fact of event.payload.evaluation.validated_facts) {
        snapshot.validated_facts.push(fact);
      }

      for (const factId of event.payload.evaluation.invalidated_fact_ids) {
        const fact = snapshot.validated_facts.find((item) => item.id === factId);
        if (fact) {
          fact.still_valid = false;
        }
      }

      if (event.payload.evaluation.failed_checks.length > 0) {
        const key = fingerprintKey(event.payload.evaluation.failure_fingerprint);
        const existing = snapshot.failure_patterns.find((pattern) => pattern.fingerprint_key === key);
        if (existing) {
          existing.seen_count = event.payload.evaluation.repeated_fingerprint_count;
          existing.last_seen_round = event.payload.evaluation.round_id;
          existing.latest_severity = event.payload.evaluation.severity;
          existing.latest_details = event.payload.evaluation.failed_checks.map((item) => item.detail);
          if (round && !existing.strategies_seen.includes(round.strategy)) {
            existing.strategies_seen.push(round.strategy);
          }
        } else {
          snapshot.failure_patterns.push({
            task_id: snapshot.task.task_id,
            fingerprint_key: key,
            failure_fingerprint: event.payload.evaluation.failure_fingerprint,
            first_seen_round: event.payload.evaluation.round_id,
            last_seen_round: event.payload.evaluation.round_id,
            seen_count: Math.max(event.payload.evaluation.repeated_fingerprint_count, 1),
            strategies_seen: round ? [round.strategy] : ["patch"],
            latest_severity: event.payload.evaluation.severity,
            latest_details: event.payload.evaluation.failed_checks.map((item) => item.detail),
            suspected_scope:
              event.payload.evaluation.failure_fingerprint.includes("scope:broad")
                ? "broad"
                : event.payload.evaluation.failure_fingerprint.includes("scope:narrow")
                  ? "narrow"
                  : "medium"
          });
        }
      }
      snapshot.task.updated_at = event.occurred_at;
      return snapshot;
    }
    case "decision_recorded": {
      const round = snapshot.rounds.find((item) => item.round_id === event.payload.decision.round_id);
      if (round) {
        round.decision = event.payload.decision;
        round.updated_at = event.occurred_at;
      }
      snapshot.task.runtime_state = event.payload.decision.terminal_reason ? "deciding" : "ready";
      snapshot.task.updated_at = event.occurred_at;
      snapshot.task.current_strategy = event.payload.decision.next_strategy ?? snapshot.task.current_strategy;
      const stat = ensureStrategyStat(snapshot, round?.strategy);
      if (stat && round?.evaluation?.repeated_fingerprint_count && round.evaluation.repeated_fingerprint_count > 1) {
        stat.repeated_failure_count += 1;
      }
      return snapshot;
    }
    case "task_completed":
    case "task_partially_returned":
    case "task_stopped":
    case "task_errored": {
      snapshot.task.runtime_state =
        event.type === "task_completed"
          ? "completed"
          : event.type === "task_partially_returned"
            ? "partial"
            : event.type === "task_stopped"
              ? "stopped"
              : "errored";
      snapshot.task.terminal_reason = event.payload.terminal.terminal_reason;
      snapshot.task.stop_trigger = event.payload.terminal.stop_trigger;
      snapshot.task.best_known_state = event.payload.terminal.best_known_state;
      snapshot.task.updated_at = event.occurred_at;
      snapshot.task.active_round_id = undefined;
      const stat = ensureStrategyStat(snapshot, snapshot.task.current_strategy);
      if (stat) {
        if (event.type === "task_completed") {
          stat.passes += 1;
        } else if (event.type === "task_partially_returned") {
          stat.partials += 1;
        } else {
          stat.stop_caused += 1;
        }
      }
      return snapshot;
    }
    default:
      return snapshot;
  }
}

export function replayEvents(events: AnchorEvent[]): ProjectionSnapshot {
  let snapshot: ProjectionSnapshot | null = null;
  for (const event of events) {
    snapshot = applyEvent(snapshot, event);
  }
  if (!snapshot) {
    throw new Error("Cannot replay empty event stream.");
  }
  return snapshot;
}

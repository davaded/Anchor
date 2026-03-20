import type { AnchorEvent, BackendResult, GoalCore, ProjectionSnapshot, ResumeInput, RoundInput, TaskInspection, TaskReplayView, TerminalResult } from "../types";
import type { BackendAdapter, StorageEngine } from "../contracts";
import { AnchorEventSchema, GoalCoreSchema, ProjectionSnapshotSchema } from "../schema";
import { createEventId, createGoalId, createRoundId, createTaskId, nowIso } from "./ids";
import { createInterruptedRecoveryResult, evaluateRound } from "./evaluator";
import { replayEvents } from "./projection";
import { decideNextStep, toTerminalResult } from "./strategy";

export interface RuntimeDependencies {
  storage: StorageEngine;
  adapters: Record<string, BackendAdapter>;
}

export class AnchorRuntimeEngine {
  private readonly storage: StorageEngine;
  private readonly adapters: Record<string, BackendAdapter>;

  public constructor(deps: RuntimeDependencies) {
    this.storage = deps.storage;
    this.adapters = deps.adapters;
  }

  public static materializeGoal(input: {
    goal: string;
    constraints?: string[];
    success_criteria?: string[];
    stop_policy?: GoalCore["stop_policy"];
    cwd?: string;
  }): GoalCore {
    return GoalCoreSchema.parse({
      goal_id: createGoalId(),
      goal: input.goal,
      constraints: input.constraints ?? [],
      success_criteria: input.success_criteria ?? [],
      stop_policy: input.stop_policy ?? {
        max_rounds: 6,
        max_same_failure: 2,
        allow_partial: true
      },
      cwd: input.cwd
    });
  }

  public async run(input: { backend_id: string; goal: GoalCore }): Promise<TerminalResult> {
    await this.start(input.goal, input.backend_id);
    let snapshot = await this.requireSnapshot(input.goal.goal_id.replace(/^goal_/, "task_"));
    while (!this.isTerminal(snapshot.task.runtime_state)) {
      snapshot = await this.step(snapshot.task.task_id, input.backend_id);
    }
    return {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      terminal_reason: snapshot.task.terminal_reason ?? "runtime_error",
      stop_trigger: snapshot.task.stop_trigger,
      summary: snapshot.task.best_known_state.summary,
      best_known_state: snapshot.task.best_known_state,
      completed_at: snapshot.task.updated_at
    };
  }

  public async start(goal: GoalCore, backendId: string) {
    const materialized = GoalCoreSchema.parse(goal);
    const adapter = this.requireAdapter(backendId);
    const taskId = materialized.goal_id.replace(/^goal_/, "task_");
    const event = this.makeEvent(taskId, materialized.goal_id, "goal_started", {
      goal: materialized,
      backend_id: adapter.describe().backend_id,
      cwd: materialized.cwd
    });
    await this.storage.append([event]);
    const snapshot = await this.requireSnapshot(taskId);
    return snapshot.task;
  }

  public async resume(input: ResumeInput): Promise<TerminalResult> {
    let snapshot = await this.requireSnapshot(input.task_id);
    if (this.isTerminal(snapshot.task.runtime_state)) {
      throw new Error(`Task ${input.task_id} is terminal and can only be replayed or inspected.`);
    }

    const backendId = input.backend_id ?? snapshot.task.backend_id;
    if (snapshot.task.runtime_state === "dispatching" || snapshot.task.runtime_state === "awaiting_backend") {
      snapshot = await this.recoverInterruptedRound(snapshot, backendId);
    }

    while (!this.isTerminal(snapshot.task.runtime_state)) {
      snapshot = await this.step(snapshot.task.task_id, backendId);
    }

    return {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      terminal_reason: snapshot.task.terminal_reason ?? "runtime_error",
      stop_trigger: snapshot.task.stop_trigger,
      summary: snapshot.task.best_known_state.summary,
      best_known_state: snapshot.task.best_known_state,
      completed_at: snapshot.task.updated_at
    };
  }

  public async inspect(taskId: string): Promise<TaskInspection> {
    const snapshot = await this.requireSnapshot(taskId);
    return {
      task: snapshot.task,
      rounds: snapshot.rounds,
      artifacts: snapshot.artifacts
    };
  }

  public async replay(taskId: string): Promise<TaskReplayView> {
    const events = await this.storage.listEvents(taskId);
    const snapshot = replayEvents(events);
    return {
      task: snapshot.task,
      events,
      snapshot
    };
  }

  public async step(taskId: string, backendId: string): Promise<ProjectionSnapshot> {
    const snapshot = await this.requireSnapshot(taskId);
    if (this.isTerminal(snapshot.task.runtime_state)) {
      return snapshot;
    }

    if (snapshot.task.runtime_state !== "ready") {
      if (snapshot.task.runtime_state === "dispatching" || snapshot.task.runtime_state === "awaiting_backend") {
        return this.recoverInterruptedRound(snapshot, backendId);
      }
      return snapshot;
    }

    const adapter = this.requireAdapter(backendId);
    const lastRound = snapshot.rounds.at(-1);
    const ordinal = snapshot.rounds.length + 1;
    const round: RoundInput = {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      round_id: createRoundId(ordinal),
      strategy: snapshot.task.current_strategy ?? "patch",
      task_slice:
        snapshot.task.current_strategy === "decompose" && lastRound?.evaluation?.failed_checks.length
          ? lastRound.evaluation.failed_checks[0].detail
          : snapshot.task.goal.goal,
      instructions:
        lastRound?.decision?.next_instructions.length
          ? lastRound.decision.next_instructions
          : ["Preserve validated behavior and work only on the current task slice."],
      constraints: snapshot.task.goal.constraints,
      cwd: snapshot.task.goal.cwd,
      context: {
        relevant_files: lastRound?.backend_result?.derived.files.map((file) => file.path),
        latest_failure_summary: lastRound?.evaluation?.failed_checks.map((item) => item.detail),
        validated_facts: snapshot.validated_facts.filter((item) => item.still_valid).map((item) => item.statement)
      }
    };

    await this.storage.append([
      this.makeEvent(taskId, snapshot.task.goal.goal_id, "round_built", { round }, round.round_id),
      this.makeEvent(taskId, snapshot.task.goal.goal_id, "round_dispatched", { round_id: round.round_id, backend_id: adapter.describe().backend_id }, round.round_id)
    ]);

    let result: BackendResult;
    try {
      result = await adapter.execute(round);
    } catch (error) {
      const terminal = {
        task_id: taskId,
        goal_id: snapshot.task.goal.goal_id,
        terminal_reason: "runtime_error" as const,
        stop_trigger: "runtime_error_detected" as const,
        summary: error instanceof Error ? error.message : "Unknown runtime error.",
        best_known_state: snapshot.task.best_known_state,
        completed_at: nowIso()
      };
      await this.storage.append([
        this.makeEvent(taskId, snapshot.task.goal.goal_id, "task_errored", { terminal })
      ]);
      return this.requireSnapshot(taskId);
    }

    return this.completeRound(await this.requireSnapshot(taskId), round, result);
  }

  private async recoverInterruptedRound(snapshot: ProjectionSnapshot, backendId: string): Promise<ProjectionSnapshot> {
    const round = snapshot.rounds.find((item) => item.round_id === snapshot.task.active_round_id);
    if (!round) {
      return snapshot;
    }
    const adapter = this.requireAdapter(backendId);
    const result = createInterruptedRecoveryResult({
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      round_id: round.round_id,
      strategy: round.strategy,
      task_slice: round.task_slice,
      instructions: round.instructions,
      constraints: snapshot.task.goal.constraints,
      cwd: snapshot.task.goal.cwd,
      context: {}
    }, adapter.describe());
    return this.completeRound(snapshot, {
      task_id: snapshot.task.task_id,
      goal_id: snapshot.task.goal.goal_id,
      round_id: round.round_id,
      strategy: round.strategy,
      task_slice: round.task_slice,
      instructions: round.instructions,
      constraints: snapshot.task.goal.constraints,
      cwd: snapshot.task.goal.cwd,
      context: {}
    }, result);
  }

  private async completeRound(snapshot: ProjectionSnapshot, round: RoundInput, result: BackendResult): Promise<ProjectionSnapshot> {
    const evaluation = evaluateRound({ snapshot, round, result });
    const decision = decideNextStep(snapshot, round, evaluation);
    const events: AnchorEvent[] = [
      this.makeEvent(snapshot.task.task_id, snapshot.task.goal.goal_id, "backend_result_recorded", { result }, round.round_id),
      this.makeEvent(snapshot.task.task_id, snapshot.task.goal.goal_id, "evaluation_recorded", { evaluation }, round.round_id),
      this.makeEvent(snapshot.task.task_id, snapshot.task.goal.goal_id, "decision_recorded", { decision }, round.round_id)
    ];

    if (decision.terminal_reason) {
      const terminal = toTerminalResult(snapshot, decision, evaluation);
      const terminalEventType =
        decision.terminal_reason === "success"
          ? "task_completed"
          : decision.decision === "return_partial"
            ? "task_partially_returned"
            : decision.terminal_reason === "runtime_error"
              ? "task_errored"
              : "task_stopped";
      events.push(this.makeEvent(snapshot.task.task_id, snapshot.task.goal.goal_id, terminalEventType, { terminal }, round.round_id));
    }

    await this.storage.append(events);
    return this.requireSnapshot(snapshot.task.task_id);
  }

  private isTerminal(state: ProjectionSnapshot["task"]["runtime_state"]) {
    return state === "completed" || state === "partial" || state === "stopped" || state === "errored";
  }

  private requireAdapter(backendId: string): BackendAdapter {
    const adapter = this.adapters[backendId];
    if (!adapter) {
      throw new Error(`Unknown backend adapter: ${backendId}`);
    }
    return adapter;
  }

  private async requireSnapshot(taskId: string) {
    const snapshot = await this.storage.getSnapshot(taskId);
    if (!snapshot) {
      throw new Error(`Task ${taskId} was not found.`);
    }
    return ProjectionSnapshotSchema.parse(snapshot);
  }

  private makeEvent<T extends AnchorEvent["type"]>(
    taskId: string,
    goalId: string,
    type: T,
    payload: Extract<AnchorEvent, { type: T }>["payload"],
    roundId?: string
  ) {
    return AnchorEventSchema.parse({
      event_id: createEventId(),
      task_id: taskId,
      goal_id: goalId,
      round_id: roundId,
      occurred_at: nowIso(),
      type,
      payload
    }) as Extract<AnchorEvent, { type: T }>;
  }
}

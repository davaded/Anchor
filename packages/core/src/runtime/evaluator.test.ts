import { describe, expect, it } from "vitest";
import { evaluateRound } from "./evaluator";
import { AnchorRuntimeEngine } from "./runtime";
import { replayEvents } from "./projection";

describe("evaluateRound", () => {
  it("does not allow self_reported success to override trusted failure", () => {
    const goal = AnchorRuntimeEngine.materializeGoal({
      goal: "Implement feature",
      success_criteria: ["Feature works"]
    });

    const snapshot = replayEvents([
      {
        event_id: "event_01JABCDEFGHJKMNPQRSTVWXYZ1",
        task_id: goal.goal_id.replace(/^goal_/, "task_"),
        goal_id: goal.goal_id,
        occurred_at: new Date().toISOString(),
        type: "goal_started",
        payload: {
          goal,
          backend_id: "codex"
        }
      }
    ]);

    const evaluation = evaluateRound({
      snapshot,
      round: {
        task_id: snapshot.task.task_id,
        goal_id: goal.goal_id,
        round_id: "round_1",
        strategy: "patch",
        task_slice: goal.goal,
        instructions: ["Implement the change"],
        constraints: [],
        context: {}
      },
      result: {
        task_id: snapshot.task.task_id,
        goal_id: goal.goal_id,
        round_id: "round_1",
        backend: {
          backend_id: "codex",
          backend_label: "Codex CLI",
          adapter_version: "0.1.0",
          execution_mode: "subprocess-cli",
          capabilities: {
            read_files: true,
            write_files: true,
            run_commands: true,
            use_tools: true,
            structured_patch_output: false,
            supports_interruption: false,
            supports_stream_events: true
          }
        },
        status: "failed",
        trusted: {
          process_exit_code: 1,
          execution_confirmed: true
        },
        derived: {
          files: [],
          commands: [],
          blockers: [],
          constraint_violations: []
        },
        self_reported: {
          summary: "Task completed successfully.",
          notes: [],
          claims: ["success"]
        },
        artifacts: []
      }
    });

    expect(evaluation.pass).toBe(false);
    expect(evaluation.failed_checks.some((item) => item.code === "PROCESS_EXIT_NON_ZERO")).toBe(true);
  });
});

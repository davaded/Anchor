import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteStorage } from "@anchor/storage-sqlite";
import { AnchorRuntimeEngine } from "./runtime";
import type { BackendAdapter, RoundInput } from "../index";

class FakeAdapter implements BackendAdapter {
  private readonly results: Array<() => Promise<any>>;

  public constructor(results: Array<() => Promise<any>>) {
    this.results = results;
  }

  public describe() {
    return {
      backend_id: "fake",
      backend_label: "Fake",
      adapter_version: "0.1.0",
      execution_mode: "test",
      capabilities: {
        read_files: true,
        write_files: true,
        run_commands: true,
        use_tools: true,
        structured_patch_output: false,
        supports_interruption: false,
        supports_stream_events: false
      }
    };
  }

  public async doctor() {
    return {
      backend_id: "fake",
      available: true,
      details: "ok"
    };
  }

  public async execute(input: RoundInput) {
    const next = this.results.shift();
    if (!next) {
      throw new Error("No fake result left.");
    }
    return next();
  }
}

function makeResult(round: RoundInput, exitCode = 0) {
  return {
    task_id: round.task_id,
    goal_id: round.goal_id,
    round_id: round.round_id,
    backend: {
      backend_id: "fake",
      backend_label: "Fake",
      adapter_version: "0.1.0",
      execution_mode: "test",
      capabilities: {
        read_files: true,
        write_files: true,
        run_commands: true,
        use_tools: true,
        structured_patch_output: false,
        supports_interruption: false,
        supports_stream_events: false
      }
    },
    status: exitCode === 0 ? "completed" : "failed",
    trusted: {
      process_exit_code: exitCode,
      execution_confirmed: true
    },
    derived: {
      files: [],
      commands: [],
      blockers: [],
      constraint_violations: []
    },
    self_reported: {
      summary: exitCode === 0 ? "done" : "failed",
      notes: [],
      claims: []
    },
    artifacts: []
  } as const;
}

describe("AnchorRuntimeEngine", () => {
  it("runs a task to success", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-runtime-"));
    const storage = new SqliteStorage(path.join(dir, "anchor.db"));
    const runtime = new AnchorRuntimeEngine({
      storage,
      adapters: {
        fake: new FakeAdapter([
          async () =>
            makeResult({
              task_id: "task_placeholder",
              goal_id: "goal_placeholder",
              round_id: "round_1",
              strategy: "patch",
              task_slice: "x",
              instructions: [],
              constraints: [],
              context: {}
            })
        ])
      }
    });

    const goal = AnchorRuntimeEngine.materializeGoal({ goal: "Ship it" });
    const taskId = goal.goal_id.replace(/^goal_/, "task_");
    runtime["adapters"].fake.execute = async (round: RoundInput) => makeResult(round);

    const result = await runtime.run({ backend_id: "fake", goal });
    expect(result.task_id).toBe(taskId);
    expect(result.terminal_reason).toBe("success");
  });

  it("recovers an in-flight round on resume", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-resume-"));
    const storage = new SqliteStorage(path.join(dir, "anchor.db"));
    const adapter = new FakeAdapter([async () => { throw new Error("runner not used"); }]);
    const runtime = new AnchorRuntimeEngine({
      storage,
      adapters: {
        fake: adapter
      }
    });

    const goal = AnchorRuntimeEngine.materializeGoal({ goal: "Recover me" });
    const taskId = goal.goal_id.replace(/^goal_/, "task_");
    await runtime.start(goal, "fake");
    await storage.append([
      {
        event_id: "event_01JABCDEFGHJKMNPQRSTVWXYZ2",
        task_id: taskId,
        goal_id: goal.goal_id,
        round_id: "round_1",
        occurred_at: new Date().toISOString(),
        type: "round_built",
        payload: {
          round: {
            task_id: taskId,
            goal_id: goal.goal_id,
            round_id: "round_1",
            strategy: "patch",
            task_slice: goal.goal,
            instructions: ["continue"],
            constraints: [],
            context: {}
          }
        }
      },
      {
        event_id: "event_01JABCDEFGHJKMNPQRSTVWXYZ3",
        task_id: taskId,
        goal_id: goal.goal_id,
        round_id: "round_1",
        occurred_at: new Date().toISOString(),
        type: "round_dispatched",
        payload: {
          round_id: "round_1",
          backend_id: "fake"
        }
      }
    ]);

    runtime["adapters"].fake.execute = async (round: RoundInput) => makeResult(round);
    const result = await runtime.resume({ task_id: taskId, backend_id: "fake" });
    expect(result.terminal_reason).toBe("success");
  });
});

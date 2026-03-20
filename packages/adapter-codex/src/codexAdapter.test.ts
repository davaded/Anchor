import { describe, expect, it } from "vitest";
import { CodexAdapter } from "./codexAdapter";

describe("CodexAdapter", () => {
  it("normalizes a successful runner result", async () => {
    const adapter = new CodexAdapter({
      runner: async () => ({
        exitCode: 0,
        stdout: "{\"message\":\"ok\"}",
        stderr: "",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      })
    });

    const result = await adapter.execute({
      task_id: "task_01JABCDEFGHJKMNPQRSTVWXYZ1",
      goal_id: "goal_01JABCDEFGHJKMNPQRSTVWXYZ1",
      round_id: "round_1",
      strategy: "patch",
      task_slice: "Fix auth flow",
      instructions: ["Fix the explicit failed checks."],
      constraints: [],
      context: {}
    });

    expect(result.status).toBe("completed");
    expect(result.trusted.process_exit_code).toBe(0);
  });

  it("returns blocked when the CLI cannot be invoked", async () => {
    const adapter = new CodexAdapter({
      runner: async () => {
        throw new Error("spawn ENOENT");
      }
    });

    const result = await adapter.execute({
      task_id: "task_01JABCDEFGHJKMNPQRSTVWXYZ1",
      goal_id: "goal_01JABCDEFGHJKMNPQRSTVWXYZ1",
      round_id: "round_1",
      strategy: "patch",
      task_slice: "Fix auth flow",
      instructions: ["Fix the explicit failed checks."],
      constraints: [],
      context: {}
    });

    expect(result.status).toBe("blocked");
    expect(result.derived.blockers[0]?.code).toBe("CLI_NOT_AVAILABLE");
  });
});

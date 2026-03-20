import { describe, expect, it } from "vitest";
import { ClaudeAdapter } from "./claudeAdapter";

describe("ClaudeAdapter", () => {
  it("normalizes a successful runner result", async () => {
    const adapter = new ClaudeAdapter({
      runner: async () => ({
        exitCode: 0,
        stdout: "{\"result\":\"ok\"}",
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
});

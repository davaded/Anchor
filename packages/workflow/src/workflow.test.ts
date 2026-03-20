import { describe, expect, it } from "vitest";
import { createWorkflowGoal } from "./workflow";

describe("workflow goal mapping", () => {
  it("builds a goal-oriented workflow request", () => {
    const goal = createWorkflowGoal({
      backend: "codex",
      goal: "Add password reset support",
      cwd: "D:\\repo"
    });

    expect(goal.goal).toContain("Add password reset support");
    expect(goal.cwd).toBe("D:\\repo");
    expect(goal.success_criteria.length).toBeGreaterThan(0);
  });

  it("preserves explicit success criteria", () => {
    const goal = createWorkflowGoal({
      backend: "claude",
      goal: "Fix the failing refresh token flow",
      success: ["The refresh flow passes validation."]
    });

    expect(goal.goal).toContain("Fix the failing refresh token flow");
    expect(goal.success_criteria).toEqual(["The refresh flow passes validation."]);
  });
});

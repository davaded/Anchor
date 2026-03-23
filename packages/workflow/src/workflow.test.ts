import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApprovalPlan, createGoalSkillRequest, createRepairGoalTarget, createTestWorkflowStrategy, createWorkflowGoal, runTestWorkflow, type TestWorkflowIssue, type TestWorkflowReport } from "./index";

describe("goal workflow mapping", () => {
  it("builds a goal-oriented workflow request from a natural-language target", () => {
    const goal = createWorkflowGoal({
      backend: "codex",
      target: "user login",
      cwd: "D:\\repo"
    });

    expect(goal.goal).toContain("user login");
    expect(goal.cwd).toBe(path.resolve("D:\\repo"));
    expect(goal.success_criteria.length).toBeGreaterThan(0);
  });

  it("defaults to current work when no explicit target is provided", () => {
    const request = createGoalSkillRequest({
      backend: "claude"
    });

    expect(request.target).toBe("current work");
    expect(request.resolved_goal).toContain("current implementation work");
  });

  it("preserves explicit success criteria", () => {
    const goal = createWorkflowGoal({
      backend: "claude",
      target: "refresh token flow",
      success: ["The refresh flow passes validation."]
    });

    expect(goal.goal).toContain("refresh token flow");
    expect(goal.success_criteria).toEqual(["The refresh flow passes validation."]);
  });
});

describe("test workflow strategy", () => {
  it("discovers repository-level typecheck and test scripts", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-test-strategy-"));
    fs.writeFileSync(
      path.join(temp, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          packageManager: "pnpm@10.0.0",
          scripts: {
            typecheck: "tsc -b",
            test: "vitest run"
          }
        },
        null,
        2
      )
    );

    const strategy = createTestWorkflowStrategy({
      target: "current work",
      cwd: temp
    });

    expect(strategy.cwd).toBe(temp);
    expect(strategy.planned_commands.map((command) => command.label)).toEqual(["typecheck", "test"]);
    expect(strategy.coverage_gaps[0]).toContain("repository-level scripts");
  });

  it("reports no executable oracle when the workspace exposes no known verification entrypoint", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-test-no-oracle-"));
    fs.writeFileSync(
      path.join(temp, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          scripts: {}
        },
        null,
        2
      )
    );

    const strategy = createTestWorkflowStrategy({
      target: "user login",
      cwd: temp
    });

    expect(strategy.planned_commands).toEqual([]);
    expect(strategy.coverage_gaps[0]).toContain("No known repository-level verification commands");
  });
});

describe("test workflow repair planning", () => {
  const baseIssue: TestWorkflowIssue = {
    issue_id: "issue_1",
    title: "test verification failed",
    severity: "high",
    impact: "Repository tests are failing within the current verification scope.",
    evidence: ["Command: pnpm test", "Status: failed"],
    fix_options: [
      {
        option_id: "A",
        summary: "Apply the smallest targeted fix needed to make test pass, then rerun the same verification step.",
        risk_level: "medium"
      },
      {
        option_id: "B",
        summary: "Perform a broader module-level repair around the test failure and add or update regression coverage before rerunning verification.",
        risk_level: "low"
      }
    ],
    recommended_option: "A"
  };

  it("maps natural-language repair replies into approved issue selections", () => {
    const plan = createApprovalPlan("issue 1 with B", [baseIssue]);

    expect(plan?.status).toBe("approved");
    expect(plan?.selected_issues).toEqual([
      {
        issue_id: "issue_1",
        title: "test verification failed",
        chosen_option: "B",
        option_summary: "Perform a broader module-level repair around the test failure and add or update regression coverage before rerunning verification."
      }
    ]);
  });

  it("understands common Chinese repair replies", () => {
    const plan = createApprovalPlan("问题1用B", [baseIssue]);

    expect(plan?.status).toBe("approved");
    expect(plan?.selected_issues[0]?.chosen_option).toBe("B");
  });

  it("creates a repair goal and completes fix-plus-regression when the approved rerun passes", async () => {
    const initialReport: TestWorkflowReport = {
      target: "current work",
      cwd: "D:\\repo",
      status: "issues_detected",
      summary: "Verification detected issues.",
      strategy: {
        target: "current work",
        cwd: "D:\\repo",
        assumptions: [],
        planned_commands: [],
        coverage_gaps: []
      },
      execution: {
        commands: [],
        passed_checks: [],
        failed_checks: ["test failed"],
        blocked_checks: [],
        coverage_gaps: []
      },
      issues: [baseIssue],
      next_actions: ["apply the recommended fixes"]
    };

    const regressionReport: TestWorkflowReport = {
      ...initialReport,
      status: "no_failure_detected",
      summary: "No failures were detected within the current verification scope.",
      execution: {
        ...initialReport.execution,
        failed_checks: [],
        passed_checks: ["test passed"]
      },
      issues: [],
      next_actions: ["Review the coverage gaps before treating this target as fully verified."]
    };

    let reportCallCount = 0;
    const result = await runTestWorkflow(
      {
        target: "current work",
        backend: "claude",
        repair: "issue 1 with B"
      },
      {
        collectReport: async () => {
          reportCallCount += 1;
          return reportCallCount === 1 ? initialReport : regressionReport;
        },
        runGoalWorkflow: async () => ({
          task_id: "task_1",
          goal_id: "goal_1",
          terminal_reason: "success",
          stop_trigger: "success_detected",
          summary: "Approved repair completed.",
          best_known_state: {
            summary: "Approved repair completed.",
            validated_items: [],
            unresolved_items: [],
            last_meaningful_round: "round_1"
          },
          completed_at: new Date().toISOString()
        })
      }
    );

    const fixGoal = createRepairGoalTarget("current work", result.approval!, initialReport);

    expect(result.status).toBe("fixed_and_regressed");
    expect(result.repair?.backend).toBe("claude");
    expect(result.repair?.fix_goal).toContain("Approved option B");
    expect(fixGoal).toContain("Only address the approved issues listed below.");
    expect(reportCallCount).toBe(2);
  });
});

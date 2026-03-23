import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { nowIso } from "@anchor/core";
import type { TerminalResult } from "@anchor/core";
import { runGoalWorkflow, type GoalWorkflowRunOptions, type WorkflowBackend } from "./workflow";

export type VerificationStatus =
  | "issues_detected"
  | "no_failure_detected"
  | "insufficient_test_oracle"
  | "verification_blocked";

export type TestWorkflowStatus =
  | VerificationStatus
  | "repair_declined"
  | "repair_selection_invalid"
  | "fixed_and_regressed"
  | "fix_applied_with_residual_risk"
  | "regression_failed";

export interface VerificationCommandPlan {
  label: string;
  command: string;
  args: string[];
  source: "package_script" | "cargo" | "go" | "pytest";
}

export interface TestWorkflowStrategy {
  target: string;
  cwd: string;
  assumptions: string[];
  planned_commands: VerificationCommandPlan[];
  coverage_gaps: string[];
}

export interface VerificationCommandResult {
  label: string;
  command: string;
  args: string[];
  source: VerificationCommandPlan["source"];
  status: "completed" | "failed" | "blocked";
  exit_code: number | null;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  stdout_excerpt: string[];
  stderr_excerpt: string[];
}

export interface TestWorkflowFixOption {
  option_id: "A" | "B";
  summary: string;
  risk_level: "low" | "medium" | "high";
}

export interface TestWorkflowIssue {
  issue_id: string;
  title: string;
  severity: "low" | "medium" | "high";
  impact: string;
  evidence: string[];
  fix_options: TestWorkflowFixOption[];
  recommended_option: "A" | "B";
}

export interface TestWorkflowReport {
  target: string;
  cwd: string;
  status: VerificationStatus;
  summary: string;
  strategy: TestWorkflowStrategy;
  execution: {
    commands: VerificationCommandResult[];
    passed_checks: string[];
    failed_checks: string[];
    blocked_checks: string[];
    coverage_gaps: string[];
  };
  issues: TestWorkflowIssue[];
  next_actions: string[];
}

export interface ApprovedRepairIssue {
  issue_id: string;
  title: string;
  chosen_option: "A" | "B";
  option_summary: string;
}

export interface TestWorkflowApprovalPlan {
  raw_reply: string;
  status: "approved" | "declined" | "invalid";
  summary: string;
  selected_issues: ApprovedRepairIssue[];
}

export interface TestWorkflowRepairResult {
  backend: WorkflowBackend;
  requested_reply: string;
  plan: TestWorkflowApprovalPlan;
  fix_goal: string;
  terminal_result: TerminalResult;
  regression: TestWorkflowReport;
}

export interface TestWorkflowResult {
  mode: "test";
  target: string;
  cwd: string;
  status: TestWorkflowStatus;
  summary: string;
  report: TestWorkflowReport;
  approval?: TestWorkflowApprovalPlan;
  repair?: TestWorkflowRepairResult;
  next_actions: string[];
}

export interface TestWorkflowRunOptions {
  target?: string;
  cwd?: string;
  backend?: WorkflowBackend;
  repair?: string;
  stateDir?: string;
  maxRounds?: number;
  maxSameFailure?: number;
  allowPartial?: boolean;
}

export interface TestWorkflowDeps {
  runGoalWorkflow: (options: GoalWorkflowRunOptions) => Promise<TerminalResult>;
  collectReport: (options: TestWorkflowRunOptions) => Promise<TestWorkflowReport>;
}

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

interface PackageManifest {
  packageManager?: string;
  scripts?: Record<string, string>;
}

const defaultDeps: TestWorkflowDeps = {
  runGoalWorkflow,
  collectReport: collectTestWorkflowReport
};

function normalizeTargetText(target?: string) {
  const normalized = target?.trim();
  return normalized && normalized.length > 0 ? normalized : "current work";
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function findWorkspaceRoot(startDir: string) {
  let current = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, "package.json")) ||
      fs.existsSync(path.join(current, "Cargo.toml")) ||
      fs.existsSync(path.join(current, "go.mod")) ||
      fs.existsSync(path.join(current, "pyproject.toml"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

function detectPackageManager(rootDir: string, manifest: PackageManifest | null): PackageManager {
  if (manifest?.packageManager?.startsWith("pnpm@")) return "pnpm";
  if (manifest?.packageManager?.startsWith("yarn@")) return "yarn";
  if (manifest?.packageManager?.startsWith("bun@")) return "bun";
  if (fs.existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(rootDir, "bun.lockb")) || fs.existsSync(path.join(rootDir, "bun.lock"))) return "bun";
  return "npm";
}

function buildScriptCommand(packageManager: PackageManager, scriptName: string) {
  switch (packageManager) {
    case "pnpm":
      return { command: "pnpm", args: [scriptName] };
    case "yarn":
      return { command: "yarn", args: [scriptName] };
    case "bun":
      return { command: "bun", args: ["run", scriptName] };
    case "npm":
    default:
      return { command: "npm", args: ["run", scriptName] };
  }
}

function buildNodeStrategy(rootDir: string, target: string, manifest: PackageManifest): TestWorkflowStrategy {
  const packageManager = detectPackageManager(rootDir, manifest);
  const scripts = manifest.scripts ?? {};
  const plannedCommands: VerificationCommandPlan[] = [];
  const coverageGaps: string[] = [];
  const assumptions = [
    "Verification runs from the nearest workspace root with a package manifest.",
    target === "current work"
      ? "Current-work verification defaults to repository-level scripts because targeted selection is not yet implemented."
      : `Feature-specific verification for "${target}" currently falls back to repository-level scripts.`
  ];

  if (typeof scripts.typecheck === "string" && !scripts.test?.includes("typecheck")) {
    const command = buildScriptCommand(packageManager, "typecheck");
    plannedCommands.push({
      label: "typecheck",
      command: command.command,
      args: command.args,
      source: "package_script"
    });
  }

  if (typeof scripts.test === "string") {
    const command = buildScriptCommand(packageManager, "test");
    plannedCommands.push({
      label: "test",
      command: command.command,
      args: command.args,
      source: "package_script"
    });
  }

  if (plannedCommands.length > 0) {
    coverageGaps.push("Targeted test selection is not yet implemented; repository-level scripts were used.");
  } else {
    coverageGaps.push("No known repository-level verification commands were discovered.");
  }

  return {
    target,
    cwd: rootDir,
    assumptions,
    planned_commands: plannedCommands,
    coverage_gaps: coverageGaps
  };
}

function buildNonNodeStrategy(rootDir: string, target: string): TestWorkflowStrategy {
  const assumptions = [
    "Verification runs from the nearest workspace root detected from the current working directory."
  ];

  if (target !== "current work") {
    assumptions.push(`Feature-specific verification for "${target}" currently falls back to repository-level checks.`);
  }

  if (fs.existsSync(path.join(rootDir, "Cargo.toml"))) {
    return {
      target,
      cwd: rootDir,
      assumptions,
      planned_commands: [
        {
          label: "cargo test",
          command: "cargo",
          args: ["test"],
          source: "cargo"
        }
      ],
      coverage_gaps: ["Targeted Rust test selection is not yet implemented; repository-level cargo tests were used."]
    };
  }

  if (fs.existsSync(path.join(rootDir, "go.mod"))) {
    return {
      target,
      cwd: rootDir,
      assumptions,
      planned_commands: [
        {
          label: "go test",
          command: "go",
          args: ["test", "./..."],
          source: "go"
        }
      ],
      coverage_gaps: ["Targeted Go test selection is not yet implemented; repository-level go tests were used."]
    };
  }

  if (fs.existsSync(path.join(rootDir, "pyproject.toml"))) {
    return {
      target,
      cwd: rootDir,
      assumptions,
      planned_commands: [
        {
          label: "pytest",
          command: "python",
          args: ["-m", "pytest"],
          source: "pytest"
        }
      ],
      coverage_gaps: ["Targeted Python test selection is not yet implemented; repository-level pytest runs were used."]
    };
  }

  return {
    target,
    cwd: rootDir,
    assumptions,
    planned_commands: [],
    coverage_gaps: ["No known repository-level verification commands were discovered."]
  };
}

export function createTestWorkflowStrategy(options: TestWorkflowRunOptions): TestWorkflowStrategy {
  const target = normalizeTargetText(options.target);
  const requestedDir = path.resolve(options.cwd ?? process.cwd());
  const rootDir = findWorkspaceRoot(requestedDir);
  const packageJsonPath = path.join(rootDir, "package.json");
  const manifest = fs.existsSync(packageJsonPath) ? readJsonFile<PackageManifest>(packageJsonPath) : null;

  if (manifest) {
    return buildNodeStrategy(rootDir, target, manifest);
  }

  return buildNonNodeStrategy(rootDir, target);
}

function collectExcerpt(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-6);
}

async function runVerificationCommand(plan: VerificationCommandPlan, cwd: string): Promise<VerificationCommandResult> {
  const startedAt = nowIso();

  return new Promise((resolve) => {
    const child = spawn(plan.command, plan.args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32"
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      const finishedAt = nowIso();
      resolve({
        label: plan.label,
        command: plan.command,
        args: plan.args,
        source: plan.source,
        status: "blocked",
        exit_code: null,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: Date.parse(finishedAt) - Date.parse(startedAt),
        stdout_excerpt: collectExcerpt(stdout),
        stderr_excerpt: collectExcerpt(error instanceof Error ? error.message : String(error))
      });
    });

    child.on("close", (exitCode) => {
      const finishedAt = nowIso();
      resolve({
        label: plan.label,
        command: plan.command,
        args: plan.args,
        source: plan.source,
        status: exitCode === 0 ? "completed" : "failed",
        exit_code: exitCode,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: Date.parse(finishedAt) - Date.parse(startedAt),
        stdout_excerpt: collectExcerpt(stdout),
        stderr_excerpt: collectExcerpt(stderr)
      });
    });
  });
}

function buildFixOptions(label: string): TestWorkflowFixOption[] {
  return [
    {
      option_id: "A",
      summary: `Apply the smallest targeted fix needed to make ${label} pass, then rerun the same verification step.`,
      risk_level: "medium"
    },
    {
      option_id: "B",
      summary: `Perform a broader module-level repair around the ${label} failure and add or update regression coverage before rerunning verification.`,
      risk_level: "low"
    }
  ];
}

function buildIssues(results: VerificationCommandResult[]): TestWorkflowIssue[] {
  return results
    .filter((result) => result.status !== "completed")
    .map((result, index) => ({
      issue_id: `issue_${index + 1}`,
      title: `${result.label} verification failed`,
      severity: result.status === "blocked" ? "high" : result.label === "test" ? "high" : "medium",
      impact:
        result.status === "blocked"
          ? `Anchor could not execute the ${result.label} verification step.`
          : result.label === "test"
            ? "Repository tests are failing within the current verification scope."
            : "Repository verification is failing within the current verification scope.",
      evidence: [
        `Command: ${result.command} ${result.args.join(" ")}`.trim(),
        `Status: ${result.status}`,
        ...(result.exit_code === null ? [] : [`Exit code: ${result.exit_code}`]),
        ...result.stderr_excerpt,
        ...result.stdout_excerpt
      ],
      fix_options: buildFixOptions(result.label),
      recommended_option: "A"
    }));
}

export function createApprovalPlan(reply: string | undefined, issues: TestWorkflowIssue[]): TestWorkflowApprovalPlan | undefined {
  const trimmed = reply?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.toLowerCase();

  if (/do not fix|don't fix|keep the report|report only|not now|先不修|先不要修|暂不修|只保留报告/.test(normalized)) {
    return {
      raw_reply: trimmed,
      status: "declined",
      summary: "Repair was explicitly declined; keeping the verification report only.",
      selected_issues: []
    };
  }

  if (issues.length === 0) {
    return {
      raw_reply: trimmed,
      status: "invalid",
      summary: "No repairable issues are present in the current verification report.",
      selected_issues: []
    };
  }

  if (/apply the recommended|recommended fixes|fix all recommended|按推荐方案修|按推荐修|按推荐方案/.test(normalized)) {
    return {
      raw_reply: trimmed,
      status: "approved",
      summary: "Applying the recommended option for each reported issue.",
      selected_issues: issues.map((issue) => ({
        issue_id: issue.issue_id,
        title: issue.title,
        chosen_option: issue.recommended_option,
        option_summary: issue.fix_options.find((option) => option.option_id === issue.recommended_option)?.summary ?? ""
      }))
    };
  }

  const explicitSelections = new Map<number, "A" | "B">();
  for (const match of trimmed.matchAll(/(?:issue\s*)?(\d+)\s*(?:with|use)\s*([ab])/gi)) {
    explicitSelections.set(Number(match[1]), match[2].toUpperCase() as "A" | "B");
  }
  for (const match of trimmed.matchAll(/(?:问题\s*)?(\d+)\s*用\s*([ab])/gi)) {
    explicitSelections.set(Number(match[1]), match[2].toUpperCase() as "A" | "B");
  }

  const recommendedSelections = new Set<number>();
  for (const match of trimmed.matchAll(/(?:fix\s+)?issue\s*(\d+)(?:\s+only)?/gi)) {
    recommendedSelections.add(Number(match[1]));
  }
  for (const match of trimmed.matchAll(/(?:只修)?问题\s*(\d+)(?:\s*即可|\s*就行|\s*only)?/gi)) {
    recommendedSelections.add(Number(match[1]));
  }

  const selectedIssues: ApprovedRepairIssue[] = [];
  for (const [issueNumber, chosenOption] of explicitSelections.entries()) {
    const issue = issues[issueNumber - 1];
    if (!issue) continue;
    selectedIssues.push({
      issue_id: issue.issue_id,
      title: issue.title,
      chosen_option: chosenOption,
      option_summary: issue.fix_options.find((option) => option.option_id === chosenOption)?.summary ?? ""
    });
    recommendedSelections.delete(issueNumber);
  }

  for (const issueNumber of recommendedSelections.values()) {
    const issue = issues[issueNumber - 1];
    if (!issue) continue;
    selectedIssues.push({
      issue_id: issue.issue_id,
      title: issue.title,
      chosen_option: issue.recommended_option,
      option_summary: issue.fix_options.find((option) => option.option_id === issue.recommended_option)?.summary ?? ""
    });
  }

  const dedupedIssues = selectedIssues.filter((issue, index, all) => all.findIndex((item) => item.issue_id === issue.issue_id) === index);

  if (dedupedIssues.length === 0) {
    return {
      raw_reply: trimmed,
      status: "invalid",
      summary: "The repair reply did not map cleanly to any reported issue. Use replies such as 'apply the recommended fixes' or 'issue 1 with A'.",
      selected_issues: []
    };
  }

  return {
    raw_reply: trimmed,
    status: "approved",
    summary: `Applying approved repairs for ${dedupedIssues.length} issue(s).`,
    selected_issues: dedupedIssues
  };
}

export function createRepairGoalTarget(target: string, plan: TestWorkflowApprovalPlan, report: TestWorkflowReport) {
  const lines = [
    `Repair the approved verification issues for target "${target}" in this repository.`,
    "Only address the approved issues listed below.",
    "Do not widen scope beyond the approved repair set.",
    "Preserve unrelated validated behavior.",
    "Leave the repository ready for rerunning verification after the repair."
  ];

  for (const item of plan.selected_issues) {
    const issue = report.issues.find((candidate) => candidate.issue_id === item.issue_id);
    lines.push(`Issue ${issue?.issue_id ?? item.issue_id}: ${item.title}`);
    lines.push(`Approved option ${item.chosen_option}: ${item.option_summary}`);
    if (issue) {
      lines.push(`Impact: ${issue.impact}`);
      for (const evidence of issue.evidence.slice(0, 4)) {
        lines.push(`Evidence: ${evidence}`);
      }
    }
  }

  return lines.join("\n");
}

function resolveRepairBackend(backend?: WorkflowBackend): WorkflowBackend {
  return backend ?? ((process.env.ANCHOR_BACKEND as WorkflowBackend | undefined) ?? "codex");
}

function buildRepairWorkflowOptions(options: TestWorkflowRunOptions, fixGoal: string): GoalWorkflowRunOptions {
  return {
    backend: resolveRepairBackend(options.backend),
    target: fixGoal,
    cwd: options.cwd,
    stateDir: options.stateDir,
    maxRounds: options.maxRounds,
    maxSameFailure: options.maxSameFailure,
    allowPartial: options.allowPartial,
    constraints: [
      "Only repair the approved verification issues.",
      "Do not expand into unrelated modules.",
      "Preserve unrelated validated behavior."
    ],
    success: [
      "The approved verification issues are addressed or materially improved.",
      "The repository remains ready for rerunning verification."
    ]
  };
}

function nextActionsForRepairSelectionInvalid() {
  return [
    "Use a reply such as: apply the recommended fixes.",
    "Or choose explicit issues such as: issue 1 with A, issue 2 with B."
  ];
}

export async function collectTestWorkflowReport(options: TestWorkflowRunOptions = {}): Promise<TestWorkflowReport> {
  const strategy = createTestWorkflowStrategy(options);

  if (strategy.planned_commands.length === 0) {
    return {
      target: strategy.target,
      cwd: strategy.cwd,
      status: "insufficient_test_oracle",
      summary: "No executable verification command was discovered in the current workspace.",
      strategy,
      execution: {
        commands: [],
        passed_checks: [],
        failed_checks: [],
        blocked_checks: [],
        coverage_gaps: strategy.coverage_gaps
      },
      issues: [],
      next_actions: [
        "Add or expose a repository-level test script or verification command.",
        "Provide a narrower target only after a reliable executable test oracle exists."
      ]
    };
  }

  const commandResults: VerificationCommandResult[] = [];
  for (const plan of strategy.planned_commands) {
    commandResults.push(await runVerificationCommand(plan, strategy.cwd));
  }

  const issues = buildIssues(commandResults);
  const passedChecks = commandResults
    .filter((result) => result.status === "completed")
    .map((result) => `${result.label} passed`);
  const failedChecks = commandResults
    .filter((result) => result.status === "failed")
    .map((result) => `${result.label} failed`);
  const blockedChecks = commandResults
    .filter((result) => result.status === "blocked")
    .map((result) => `${result.label} could not run`);

  const status: VerificationStatus =
    blockedChecks.length > 0 && failedChecks.length === 0
      ? "verification_blocked"
      : issues.length > 0
        ? "issues_detected"
        : "no_failure_detected";

  return {
    target: strategy.target,
    cwd: strategy.cwd,
    status,
    summary:
      status === "no_failure_detected"
        ? "No failures were detected within the current verification scope."
        : status === "verification_blocked"
          ? "Verification could not complete because one or more planned checks could not be executed."
          : "Verification detected issues. User approval is required before any repair flow begins.",
    strategy,
    execution: {
      commands: commandResults,
      passed_checks: passedChecks,
      failed_checks: failedChecks,
      blocked_checks: blockedChecks,
      coverage_gaps: strategy.coverage_gaps
    },
    issues,
    next_actions:
      issues.length === 0
        ? ["Review the coverage gaps before treating this target as fully verified."]
        : [
            "Review the issue list and choose which issues to fix.",
            "Reply with a repair choice such as: apply the recommended fixes, issue 1 with A, or do not fix yet."
          ]
  };
}

export async function runTestWorkflow(
  options: TestWorkflowRunOptions = {},
  deps: TestWorkflowDeps = defaultDeps
): Promise<TestWorkflowResult> {
  const report = await deps.collectReport(options);

  if (!options.repair) {
    return {
      mode: "test",
      target: report.target,
      cwd: report.cwd,
      status: report.status,
      summary: report.summary,
      report,
      next_actions: report.next_actions
    };
  }

  const approval = createApprovalPlan(options.repair, report.issues);
  if (!approval) {
    return {
      mode: "test",
      target: report.target,
      cwd: report.cwd,
      status: report.status,
      summary: report.summary,
      report,
      next_actions: report.next_actions
    };
  }

  if (approval.status === "declined") {
    return {
      mode: "test",
      target: report.target,
      cwd: report.cwd,
      status: "repair_declined",
      summary: approval.summary,
      report,
      approval,
      next_actions: ["Run anchor test again when you want to apply a repair choice."]
    };
  }

  if (approval.status === "invalid") {
    return {
      mode: "test",
      target: report.target,
      cwd: report.cwd,
      status: "repair_selection_invalid",
      summary: approval.summary,
      report,
      approval,
      next_actions: nextActionsForRepairSelectionInvalid()
    };
  }

  const fixGoal = createRepairGoalTarget(report.target, approval, report);
  const repairOptions = buildRepairWorkflowOptions(options, fixGoal);
  const terminalResult = await deps.runGoalWorkflow(repairOptions);
  const regression = await deps.collectReport({
    target: report.target,
    cwd: report.cwd
  });

  const repair: TestWorkflowRepairResult = {
    backend: repairOptions.backend,
    requested_reply: options.repair,
    plan: approval,
    fix_goal: fixGoal,
    terminal_result: terminalResult,
    regression
  };

  if (regression.status === "no_failure_detected") {
    return {
      mode: "test",
      target: report.target,
      cwd: report.cwd,
      status: "fixed_and_regressed",
      summary: "Approved repairs were applied and regression checks passed within the current verification scope.",
      report,
      approval,
      repair,
      next_actions: regression.next_actions
    };
  }

  if (regression.status === "issues_detected") {
    return {
      mode: "test",
      target: report.target,
      cwd: report.cwd,
      status: "regression_failed",
      summary: "Approved repairs were applied, but regression checks still reported issues.",
      report,
      approval,
      repair,
      next_actions: [
        "Review the regression report and decide whether to continue with another approved repair attempt.",
        "Narrow the failing issue set before rerunning anchor test with a repair choice."
      ]
    };
  }

  return {
    mode: "test",
    target: report.target,
    cwd: report.cwd,
    status: "fix_applied_with_residual_risk",
    summary: "Approved repairs were applied, but regression could not fully verify the result.",
    report,
    approval,
    repair,
    next_actions: [
      "Review the regression coverage gaps before accepting the repair as complete.",
      "Rerun anchor test after restoring a stronger verification oracle if needed."
    ]
  };
}

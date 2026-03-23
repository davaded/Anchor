#!/usr/bin/env node
import { Command } from "commander";
import { doctorWorkflows, runGoalWorkflow, runTestWorkflow } from "@anchor/workflow";

function printResult(result: unknown, asJson?: boolean) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

function normalizeTargetArgument(target: string[] | undefined, fallback?: string) {
  const joined = target?.join(" ").trim();
  if (joined && joined.length > 0) {
    return joined;
  }

  const normalizedFallback = fallback?.trim();
  return normalizedFallback && normalizedFallback.length > 0 ? normalizedFallback : undefined;
}

const program = new Command();
program.name("anchor").description("Anchor skill-first control CLI for Codex and Claude Code");

program
  .command("goal")
  .argument("[target...]", "Goal target text")
  .option("--backend <backend>", "Backend adapter id: codex | claude", (process.env.ANCHOR_BACKEND ?? "codex"))
  .option("--goal <goal>", "Legacy alias for goal target text")
  .option("--constraint <constraint...>", "Goal constraints")
  .option("--success <criterion...>", "Success criteria")
  .option("--cwd <cwd>", "Working directory, defaults to the current process directory")
  .option("--max-rounds <n>", "Stop policy: max rounds", (value) => Number(value), 6)
  .option("--max-same-failure <n>", "Stop policy: max same failure", (value) => Number(value), 2)
  .option("--no-allow-partial", "Disable partial return")
  .option("--state-dir <dir>", "State directory, defaults to .anchor")
  .option("--json", "Output machine-readable JSON")
  .action(async (target, options: {
    backend: "codex" | "claude";
    goal?: string;
    constraint?: string[];
    success?: string[];
    cwd?: string;
    maxRounds: number;
    maxSameFailure: number;
    allowPartial?: boolean;
    stateDir?: string;
    json?: boolean;
  }) => {
    const resolvedTarget = normalizeTargetArgument(target, options.goal);
    if (!resolvedTarget) {
      throw new Error("A goal target is required.");
    }

    const result = await runGoalWorkflow({
      backend: options.backend,
      target: resolvedTarget,
      constraints: options.constraint ?? [],
      success: options.success ?? [],
      cwd: options.cwd,
      stateDir: options.stateDir,
      maxRounds: options.maxRounds,
      maxSameFailure: options.maxSameFailure,
      allowPartial: Boolean(options.allowPartial)
    });
    printResult(result, options.json);
  });

program
  .command("test")
  .argument("[target...]", "Verification target text")
  .option("--backend <backend>", "Backend adapter id used when a repair choice is provided", (process.env.ANCHOR_BACKEND ?? "codex"))
  .option("--repair <reply>", "Internal repair approval text for continuing from report to fix/regression")
  .option("--cwd <cwd>", "Working directory, defaults to the current process directory")
  .option("--max-rounds <n>", "Repair workflow stop policy: max rounds", (value) => Number(value), 6)
  .option("--max-same-failure <n>", "Repair workflow stop policy: max same failure", (value) => Number(value), 2)
  .option("--no-allow-partial", "Disable partial return during the repair workflow")
  .option("--state-dir <dir>", "State directory, defaults to .anchor")
  .option("--json", "Output machine-readable JSON")
  .action(async (target, options: {
    backend?: "codex" | "claude";
    repair?: string;
    cwd?: string;
    maxRounds: number;
    maxSameFailure: number;
    allowPartial?: boolean;
    stateDir?: string;
    json?: boolean;
  }) => {
    const result = await runTestWorkflow({
      target: normalizeTargetArgument(target, "current work"),
      backend: options.backend,
      repair: options.repair,
      cwd: options.cwd,
      stateDir: options.stateDir,
      maxRounds: options.maxRounds,
      maxSameFailure: options.maxSameFailure,
      allowPartial: Boolean(options.allowPartial)
    });
    printResult(result, options.json);
  });

const adapters = program.command("adapters").description("Adapter tooling");
adapters
  .command("doctor")
  .option("--state-dir <dir>", "State directory, defaults to .anchor")
  .option("--json", "Output machine-readable JSON")
  .action(async (options) => {
    const result = await doctorWorkflows(options.stateDir);
    printResult(result, options.json);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

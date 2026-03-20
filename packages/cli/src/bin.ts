#!/usr/bin/env node
import { Command } from "commander";
import { doctorWorkflows, runWorkflow } from "@anchor/workflow";

function printResult(result: unknown, asJson?: boolean) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

const program = new Command();
program.name("anchor").description("Anchor headless control runtime CLI");

program
  .command("goal")
  .requiredOption("--backend <backend>", "Backend adapter id: codex | claude")
  .requiredOption("--goal <goal>", "Goal text")
  .option("--constraint <constraint...>", "Goal constraints")
  .option("--success <criterion...>", "Success criteria")
  .option("--cwd <cwd>", "Working directory")
  .option("--max-rounds <n>", "Stop policy: max rounds", (value) => Number(value), 6)
  .option("--max-same-failure <n>", "Stop policy: max same failure", (value) => Number(value), 2)
  .option("--no-allow-partial", "Disable partial return")
  .option("--state-dir <dir>", "State directory, defaults to .anchor")
  .option("--json", "Output machine-readable JSON")
  .action(async (options) => {
    const result = await runWorkflow({
      backend: options.backend,
      goal: options.goal,
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

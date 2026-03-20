#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { defaultInstallTargets, installWorkflowAssets } from "./installer";

const program = new Command();
program.name("anchor-workflow").description("Install Anchor workflow skills and commands");

program
  .command("install")
  .option("--repo-root <dir>", "Repository root", path.resolve(process.cwd()))
  .option("--codex-dir <dir>", "Codex skills directory", defaultInstallTargets().codexDir)
  .option("--claude-skills-dir <dir>", "Claude skills directory", defaultInstallTargets().claudeSkillsDir)
  .option("--claude-commands-dir <dir>", "Claude commands directory", defaultInstallTargets().claudeCommandsDir)
  .option("--codex-only", "Install only Codex skills")
  .option("--claude-only", "Install only Claude assets")
  .action(async (options: {
    repoRoot: string;
    codexDir: string;
    claudeSkillsDir: string;
    claudeCommandsDir: string;
    codexOnly?: boolean;
    claudeOnly?: boolean;
  }) => {
    const result = await installWorkflowAssets({
      repoRoot: options.repoRoot,
      codexDir: options.codexDir,
      claudeSkillsDir: options.claudeSkillsDir,
      claudeCommandsDir: options.claudeCommandsDir,
      installCodex: options.claudeOnly ? false : true,
      installClaude: options.codexOnly ? false : true
    });
    console.log(JSON.stringify(result, null, 2));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

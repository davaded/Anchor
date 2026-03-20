import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

export interface InstallOptions {
  repoRoot?: string;
  codexDir?: string;
  claudeSkillsDir?: string;
  claudeCommandsDir?: string;
  installCodex?: boolean;
  installClaude?: boolean;
}

export interface InstallResult {
  codexSkillPath?: string;
  claudeSkillPath?: string;
  claudeCommandsPath?: string;
}

export function defaultInstallTargets() {
  const home = os.homedir();
  return {
    codexDir: path.join(home, ".codex", "skills"),
    claudeSkillsDir: path.join(home, ".claude", "skills"),
    claudeCommandsDir: path.join(home, ".claude", "commands")
  };
}

export async function installWorkflowAssets(options: InstallOptions = {}): Promise<InstallResult> {
  const repoRoot = options.repoRoot ?? path.resolve(__dirname, "..", "..", "..");
  const defaults = defaultInstallTargets();
  const installCodex = options.installCodex ?? true;
  const installClaude = options.installClaude ?? true;
  const result: InstallResult = {};

  if (installCodex) {
    const target = path.join(options.codexDir ?? defaults.codexDir, "anchor-control");
    await fs.remove(target);
    await fs.ensureDir(path.dirname(target));
    await fs.copy(
      path.join(repoRoot, "integrations", "codex", "skills", "anchor-control"),
      target,
      { overwrite: true }
    );
    result.codexSkillPath = target;
  }

  if (installClaude) {
    const skillTarget = path.join(options.claudeSkillsDir ?? defaults.claudeSkillsDir, "anchor-control");
    await fs.remove(skillTarget);
    await fs.ensureDir(path.dirname(skillTarget));
    await fs.copy(
      path.join(repoRoot, "integrations", "claude", "skills", "anchor-control"),
      skillTarget,
      { overwrite: true }
    );
    result.claudeSkillPath = skillTarget;

    const commandsTarget = path.join(options.claudeCommandsDir ?? defaults.claudeCommandsDir, "anchor");
    await fs.remove(commandsTarget);
    await fs.ensureDir(path.dirname(commandsTarget));
    await fs.copy(
      path.join(repoRoot, "integrations", "claude", "commands", "anchor"),
      commandsTarget,
      { overwrite: true }
    );
    result.claudeCommandsPath = commandsTarget;
  }

  return result;
}

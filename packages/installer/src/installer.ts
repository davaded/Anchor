import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

export interface InstallOptions {
  assetRoot?: string;
  repoRoot?: string;
  codexDir?: string;
  claudeSkillsDir?: string;
  claudeCommandsDir?: string;
  installCodex?: boolean;
  installClaude?: boolean;
}

export interface InstallResult {
  assetRoot: string;
  codexSkillPath?: string;
  claudeSkillPath?: string;
  claudeCommandsPath?: string;
}

export function defaultAssetRoot() {
  return path.resolve(__dirname, "..", "assets");
}

export function defaultInstallTargets() {
  const home = os.homedir();
  return {
    codexDir: path.join(home, ".codex", "skills"),
    claudeSkillsDir: path.join(home, ".claude", "skills"),
    claudeCommandsDir: path.join(home, ".claude", "commands")
  };
}

async function resolveAssetRoot(options: InstallOptions): Promise<string> {
  const packagedAssetRoot = options.assetRoot ?? defaultAssetRoot();
  const packagedCodexSkill = path.join(packagedAssetRoot, "codex", "anchor-control", "SKILL.md");

  if (await fs.pathExists(packagedCodexSkill)) {
    return packagedAssetRoot;
  }

  if (options.repoRoot) {
    return path.join(options.repoRoot, "integrations");
  }

  throw new Error(
    "Installer assets are missing. Rebuild the package or pass --repo-root when running from the workspace."
  );
}

export async function installWorkflowAssets(options: InstallOptions = {}): Promise<InstallResult> {
  const assetRoot = await resolveAssetRoot(options);
  const usesPackagedAssets = path.basename(assetRoot) === "assets";
  const defaults = defaultInstallTargets();
  const installCodex = options.installCodex ?? true;
  const installClaude = options.installClaude ?? true;
  const result: InstallResult = { assetRoot };

  const codexSource = usesPackagedAssets
    ? path.join(assetRoot, "codex", "anchor-control")
    : path.join(assetRoot, "codex", "skills", "anchor-control");
  const claudeSkillSource = usesPackagedAssets
    ? path.join(assetRoot, "claude", "anchor-control")
    : path.join(assetRoot, "claude", "skills", "anchor-control");
  const claudeCommandsSource = usesPackagedAssets
    ? path.join(assetRoot, "claude-commands", "anchor")
    : path.join(assetRoot, "claude", "commands", "anchor");

  if (installCodex) {
    const target = path.join(options.codexDir ?? defaults.codexDir, "anchor-control");
    await fs.remove(target);
    await fs.ensureDir(path.dirname(target));
    await fs.copy(codexSource, target, { overwrite: true });
    result.codexSkillPath = target;
  }

  if (installClaude) {
    const skillTarget = path.join(options.claudeSkillsDir ?? defaults.claudeSkillsDir, "anchor-control");
    await fs.remove(skillTarget);
    await fs.ensureDir(path.dirname(skillTarget));
    await fs.copy(claudeSkillSource, skillTarget, { overwrite: true });
    result.claudeSkillPath = skillTarget;

    const commandsTarget = path.join(options.claudeCommandsDir ?? defaults.claudeCommandsDir, "anchor");
    await fs.remove(commandsTarget);
    await fs.ensureDir(path.dirname(commandsTarget));
    await fs.copy(claudeCommandsSource, commandsTarget, { overwrite: true });
    result.claudeCommandsPath = commandsTarget;
  }

  return result;
}

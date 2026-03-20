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
  runtimeRepoRoot?: string;
}

const WORKSPACE_PACKAGE_NAME = "anchor-runtime-workspace";
const RUNTIME_CONFIG_FILE = "anchor-runtime.json";

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

async function isWorkspaceRepoRoot(dir: string): Promise<boolean> {
  const packagePath = path.join(dir, "package.json");
  if (!(await fs.pathExists(packagePath))) {
    return false;
  }

  try {
    const pkg = await fs.readJson(packagePath);
    return pkg?.name === WORKSPACE_PACKAGE_NAME;
  } catch {
    return false;
  }
}

async function findWorkspaceRepoRoot(startDir: string): Promise<string | undefined> {
  let current = path.resolve(startDir);

  while (true) {
    if (await isWorkspaceRepoRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function resolveRuntimeRepoRoot(options: InstallOptions, assetRoot: string): Promise<string | undefined> {
  if (options.repoRoot) {
    const candidate = path.resolve(options.repoRoot);
    if (!(await isWorkspaceRepoRoot(candidate))) {
      throw new Error(`--repo-root must point to an Anchor workspace: ${candidate}`);
    }
    return candidate;
  }

  const cwdRepoRoot = await findWorkspaceRepoRoot(process.cwd());
  if (cwdRepoRoot) {
    return cwdRepoRoot;
  }

  return findWorkspaceRepoRoot(assetRoot);
}

async function writeRuntimeConfig(targetDir: string, repoRoot: string) {
  await fs.writeJson(path.join(targetDir, RUNTIME_CONFIG_FILE), { repoRoot }, { spaces: 2 });
}

export async function installWorkflowAssets(options: InstallOptions = {}): Promise<InstallResult> {
  const assetRoot = await resolveAssetRoot(options);
  const runtimeRepoRoot = await resolveRuntimeRepoRoot(options, assetRoot);
  const usesPackagedAssets = path.basename(assetRoot) === "assets";
  const defaults = defaultInstallTargets();
  const installCodex = options.installCodex ?? true;
  const installClaude = options.installClaude ?? true;
  const result: InstallResult = { assetRoot, runtimeRepoRoot };

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
    if (runtimeRepoRoot) {
      await writeRuntimeConfig(target, runtimeRepoRoot);
    }
    result.codexSkillPath = target;
  }

  if (installClaude) {
    const skillTarget = path.join(options.claudeSkillsDir ?? defaults.claudeSkillsDir, "anchor-control");
    await fs.remove(skillTarget);
    await fs.ensureDir(path.dirname(skillTarget));
    await fs.copy(claudeSkillSource, skillTarget, { overwrite: true });
    if (runtimeRepoRoot) {
      await writeRuntimeConfig(skillTarget, runtimeRepoRoot);
    }
    result.claudeSkillPath = skillTarget;

    const commandsTarget = path.join(options.claudeCommandsDir ?? defaults.claudeCommandsDir, "anchor");
    await fs.remove(commandsTarget);
    await fs.ensureDir(path.dirname(commandsTarget));
    await fs.copy(claudeCommandsSource, commandsTarget, { overwrite: true });
    result.claudeCommandsPath = commandsTarget;
  }

  return result;
}

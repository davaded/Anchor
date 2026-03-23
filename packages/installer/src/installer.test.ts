import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultAssetRoot, installWorkflowAssets } from "./installer";

const repoRoot = path.resolve(__dirname, "..", "..", "..");

describe("installWorkflowAssets", () => {
  it("copies packaged assets into target directories, links the runtime, and clears stale commands", async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-installer-"));
    const codexDir = path.join(temp, "codex-skills");
    const claudeSkillsDir = path.join(temp, "claude-skills");
    const claudeCommandsDir = path.join(temp, "claude-commands");
    const staleCommandsDir = path.join(claudeCommandsDir, "anchor");

    fs.mkdirSync(staleCommandsDir, { recursive: true });
    fs.writeFileSync(path.join(staleCommandsDir, "resume.md"), "stale");

    const result = await installWorkflowAssets({
      repoRoot,
      codexDir,
      claudeSkillsDir,
      claudeCommandsDir
    });

    expect(result.assetRoot).toBe(defaultAssetRoot());
    expect(result.runtimeRepoRoot).toBe(repoRoot);
    expect(result.codexSkillPath).toBe(path.join(codexDir, "anchor-control"));
    expect(result.claudeSkillPath).toBe(path.join(claudeSkillsDir, "anchor-control"));
    expect(result.claudeCommandsPath).toBe(path.join(claudeCommandsDir, "anchor"));
    expect(fs.existsSync(path.join(codexDir, "anchor-control", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(codexDir, "anchor-control", "scripts", "anchor-control.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(codexDir, "anchor-control", "scripts", "anchor-control.ps1"))).toBe(true);
    expect(fs.existsSync(path.join(claudeCommandsDir, "anchor", "goal.md"))).toBe(true);
    expect(fs.existsSync(path.join(claudeCommandsDir, "anchor", "test.md"))).toBe(true);
    expect(fs.existsSync(path.join(claudeCommandsDir, "anchor", "resume.md"))).toBe(false);

    const runtimeConfig = JSON.parse(
      fs.readFileSync(path.join(codexDir, "anchor-control", "anchor-runtime.json"), "utf8")
    ) as { repoRoot: string };
    expect(runtimeConfig.repoRoot).toBe(repoRoot);
  });

  it("runs the installed Node wrapper against the linked workspace", async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-installer-node-"));
    const codexDir = path.join(temp, "codex-skills");

    const result = await installWorkflowAssets({
      repoRoot,
      codexDir,
      installClaude: false
    });

    const wrapperPath = path.join(result.codexSkillPath!, "scripts", "anchor-control.mjs");
    const command = spawnSync(process.execPath, [wrapperPath, "doctor", "--json"], {
      cwd: temp,
      encoding: "utf8",
      env: {
        ...process.env,
        ANCHOR_REPO_ROOT: ""
      }
    });

    expect(command.status).toBe(0);
    expect(command.stdout).toContain('"backend_id": "codex"');
    expect(command.stdout).toContain('"backend_id": "claude"');
  }, 20000);

  it("runs the installed PowerShell wrapper against the linked workspace on Windows", async () => {
    if (process.platform !== "win32") {
      return;
    }

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-installer-ps1-"));
    const codexDir = path.join(temp, "codex-skills");

    const result = await installWorkflowAssets({
      repoRoot,
      codexDir,
      installClaude: false
    });

    const wrapperPath = path.join(result.codexSkillPath!, "scripts", "anchor-control.ps1");
    const command = spawnSync(
      "powershell.exe",
      ["-ExecutionPolicy", "Bypass", "-File", wrapperPath, "doctor", "-Json"],
      {
        cwd: temp,
        encoding: "utf8",
        env: {
          ...process.env,
          ANCHOR_REPO_ROOT: ""
        }
      }
    );

    expect(command.status).toBe(0);
    expect(command.stdout).toContain('"backend_id": "codex"');
    expect(command.stdout).toContain('"backend_id": "claude"');
  }, 20000);
});

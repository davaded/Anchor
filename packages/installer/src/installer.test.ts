import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultAssetRoot, installWorkflowAssets } from "./installer";

describe("installWorkflowAssets", () => {
  it("copies packaged assets into target directories and clears stale commands", async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-installer-"));
    const codexDir = path.join(temp, "codex-skills");
    const claudeSkillsDir = path.join(temp, "claude-skills");
    const claudeCommandsDir = path.join(temp, "claude-commands");
    const staleCommandsDir = path.join(claudeCommandsDir, "anchor");

    fs.mkdirSync(staleCommandsDir, { recursive: true });
    fs.writeFileSync(path.join(staleCommandsDir, "resume.md"), "stale");

    const result = await installWorkflowAssets({
      codexDir,
      claudeSkillsDir,
      claudeCommandsDir
    });

    expect(result.assetRoot).toBe(defaultAssetRoot());
    expect(result.codexSkillPath).toBe(path.join(codexDir, "anchor-control"));
    expect(result.claudeSkillPath).toBe(path.join(claudeSkillsDir, "anchor-control"));
    expect(result.claudeCommandsPath).toBe(path.join(claudeCommandsDir, "anchor"));
    expect(fs.existsSync(path.join(codexDir, "anchor-control", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(claudeCommandsDir, "anchor", "goal.md"))).toBe(true);
    expect(fs.existsSync(path.join(claudeCommandsDir, "anchor", "resume.md"))).toBe(false);
  });
});

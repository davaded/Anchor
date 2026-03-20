import path from "node:path";
import fs from "fs-extra";

const packageRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const assetRoot = path.join(packageRoot, "assets");

await fs.remove(assetRoot);
await fs.ensureDir(assetRoot);

await fs.copy(
  path.join(repoRoot, "integrations", "codex", "skills", "anchor-control"),
  path.join(assetRoot, "codex", "anchor-control")
);

await fs.copy(
  path.join(repoRoot, "integrations", "claude", "skills", "anchor-control"),
  path.join(assetRoot, "claude", "anchor-control")
);

await fs.copy(
  path.join(repoRoot, "integrations", "claude", "commands", "anchor"),
  path.join(assetRoot, "claude-commands", "anchor")
);

console.log(`Synced installer assets into ${assetRoot}`);

import path from "node:path";
import { AnchorRuntimeEngine } from "@anchor/core";
import { CodexAdapter } from "@anchor/adapter-codex";
import { ClaudeAdapter } from "@anchor/adapter-claude";
import { LocalArtifactStore } from "@anchor/artifact-store-local";
import { SqliteStorage } from "@anchor/storage-sqlite";

export function createWorkflowServices(rootDir?: string) {
  const stateRoot = rootDir ?? path.resolve(process.cwd(), ".anchor");
  const dbPath = path.join(stateRoot, "anchor.db");
  const artifactDir = path.join(stateRoot, "artifacts");
  const storage = new SqliteStorage(dbPath);
  const artifactStore = new LocalArtifactStore(artifactDir, storage);
  const adapters = {
    codex: new CodexAdapter({ artifactStore }),
    claude: new ClaudeAdapter({ artifactStore })
  };

  return {
    stateRoot,
    storage,
    artifactStore,
    adapters,
    runtime: new AnchorRuntimeEngine({ storage, adapters })
  };
}

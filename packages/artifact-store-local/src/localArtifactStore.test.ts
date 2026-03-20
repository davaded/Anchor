import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteStorage } from "@anchor/storage-sqlite";
import { LocalArtifactStore } from "./localArtifactStore";

describe("LocalArtifactStore", () => {
  it("writes artifacts and keeps replay semantics independent from file existence", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-artifact-"));
    const storage = new SqliteStorage(path.join(dir, "anchor.db"));
    const store = new LocalArtifactStore(path.join(dir, "artifacts"), storage);

    const metadata = await store.putArtifact({
      task_id: "task_01JABCDEFGHJKMNPQRSTVWXYZ1",
      round_id: "round_1",
      event_id: "event_01JABCDEFGHJKMNPQRSTVWXYZ1",
      type: "transcript",
      producer: "test",
      content: "hello"
    });

    expect(await store.exists(metadata.artifact_id)).toBe(true);
    expect(await store.readArtifactText(metadata.artifact_id)).toBe("hello");

    fs.unlinkSync(metadata.path);
    expect(await store.exists(metadata.artifact_id)).toBe(false);
    expect(await storage.getArtifactMetadata(metadata.artifact_id)).not.toBeNull();
  });
});

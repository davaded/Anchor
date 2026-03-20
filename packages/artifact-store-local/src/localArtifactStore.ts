import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createArtifactId, nowIso } from "@anchor/core";
import type { ArtifactMetadata, ArtifactStore, ArtifactWriteInput } from "@anchor/core";

export interface ArtifactMetadataRecorder {
  recordArtifact(metadata: ArtifactMetadata): Promise<void>;
  getArtifactMetadata?(artifactId: string): Promise<ArtifactMetadata | null>;
}

export class LocalArtifactStore implements ArtifactStore {
  private readonly rootDir: string;
  private readonly recorder?: ArtifactMetadataRecorder;

  public constructor(rootDir: string, recorder?: ArtifactMetadataRecorder) {
    this.rootDir = rootDir;
    this.recorder = recorder;
  }

  public async putArtifact(input: ArtifactWriteInput): Promise<ArtifactMetadata> {
    const artifactId = createArtifactId();
    const extension = input.extension ?? "txt";
    const roundDir = input.round_id ?? "_task";
    const taskDir = path.join(this.rootDir, input.task_id, roundDir);
    await fs.mkdir(taskDir, { recursive: true });
    const filePath = path.join(taskDir, `${input.event_id}.${artifactId}.${input.type}.${extension}`);
    const buffer = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content, "utf8");
    await fs.writeFile(filePath, buffer);

    const metadata: ArtifactMetadata = {
      artifact_id: artifactId,
      task_id: input.task_id,
      round_id: input.round_id,
      event_id: input.event_id,
      type: input.type,
      producer: input.producer,
      path: filePath,
      hash: crypto.createHash("sha256").update(buffer).digest("hex"),
      size: buffer.byteLength,
      created_at: nowIso()
    };

    await this.recorder?.recordArtifact(metadata);
    return metadata;
  }

  public async readArtifactText(artifactId: string): Promise<string | null> {
    if (!this.recorder?.getArtifactMetadata) {
      return null;
    }
    const metadata = await this.recorder.getArtifactMetadata(artifactId);
    if (!metadata) {
      return null;
    }
    return fs.readFile(metadata.path, "utf8");
  }

  public async exists(artifactId: string): Promise<boolean> {
    if (!this.recorder?.getArtifactMetadata) {
      return false;
    }
    const metadata = await this.recorder.getArtifactMetadata(artifactId);
    if (!metadata) {
      return false;
    }
    try {
      await fs.access(metadata.path);
      return true;
    } catch {
      return false;
    }
  }
}

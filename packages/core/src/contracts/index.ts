import type { z } from "zod";
import type { BackendDescriptorSchema } from "../schema/index";
import type { AnchorEvent, ArtifactMetadata, BackendResult, ProjectionSnapshot, ResumeInput, RoundInput, TaskInspection, TaskProjection, TaskReplayView, TerminalResult } from "../types/index";

export interface ArtifactWriteInput {
  task_id: string;
  round_id?: string;
  event_id: string;
  type: "transcript" | "patch" | "command-log" | "evaluation-report" | "report" | "other";
  producer: string;
  extension?: string;
  content: string | Buffer;
}

export interface ArtifactStore {
  putArtifact(input: ArtifactWriteInput): Promise<ArtifactMetadata>;
  readArtifactText(artifactId: string): Promise<string | null>;
  exists(artifactId: string): Promise<boolean>;
}

export interface EventStore {
  append(events: AnchorEvent[]): Promise<void>;
  listEvents(taskId: string): Promise<AnchorEvent[]>;
}

export interface ProjectionStore {
  getSnapshot(taskId: string): Promise<ProjectionSnapshot | null>;
  listTasks(): Promise<TaskProjection[]>;
  rebuild(taskId: string): Promise<ProjectionSnapshot>;
}

export interface StorageEngine extends EventStore, ProjectionStore {}

export interface AdapterDoctorResult {
  backend_id: string;
  available: boolean;
  version?: string;
  details: string;
}

export interface BackendAdapter {
  describe(): z.infer<typeof BackendDescriptorSchema>;
  doctor(): Promise<AdapterDoctorResult>;
  execute(input: RoundInput): Promise<BackendResult>;
  interrupt?(roundId: string): Promise<void>;
}

export interface AnchorRuntime {
  run(input: { backend_id: string; goal: { goal: string; constraints?: string[]; success_criteria?: string[]; stop_policy?: { max_rounds: number; max_same_failure: number; allow_partial: boolean; budget_limit_ms?: number }; cwd?: string } }): Promise<TerminalResult>;
  resume(input: ResumeInput): Promise<TerminalResult>;
  inspect(taskId: string): Promise<TaskInspection>;
  replay(taskId: string): Promise<TaskReplayView>;
}

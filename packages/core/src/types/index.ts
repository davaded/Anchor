import type { z } from "zod";
import type { AnchorEventSchema, ArtifactMetadataSchema, BackendResultSchema, EvaluationResultSchema, GoalCoreSchema, GoalInputSchema, ProjectionSnapshotSchema, RoundInputSchema, RoundProjectionSchema, StrategyDecisionSchema, TaskProjectionSchema, TerminalResultSchema } from "../schema/index";

export type GoalInput = z.infer<typeof GoalInputSchema>;
export type GoalCore = z.infer<typeof GoalCoreSchema>;
export type RoundInput = z.infer<typeof RoundInputSchema>;
export type BackendResult = z.infer<typeof BackendResultSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type StrategyDecision = z.infer<typeof StrategyDecisionSchema>;
export type TaskProjection = z.infer<typeof TaskProjectionSchema>;
export type RoundProjection = z.infer<typeof RoundProjectionSchema>;
export type ProjectionSnapshot = z.infer<typeof ProjectionSnapshotSchema>;
export type AnchorEvent = z.infer<typeof AnchorEventSchema>;
export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;
export type TerminalResult = z.infer<typeof TerminalResultSchema>;
export type ValidatedFact = ProjectionSnapshot["validated_facts"][number];

export interface TaskReplayView {
  task: TaskProjection;
  events: AnchorEvent[];
  snapshot: ProjectionSnapshot;
}

export interface TaskInspection {
  task: TaskProjection;
  rounds: RoundProjection[];
  artifacts: ArtifactMetadata[];
}

export interface ResumeInput {
  task_id: string;
  backend_id?: string;
}

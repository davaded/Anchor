import { z } from "zod";
import { BackendResultSchema } from "./backend";
import { ArtifactMetadataSchema, BestKnownStateSchema, FailurePatternSchema, GoalIdSchema, IsoDateTimeSchema, LoopStateSchema, RoundIdSchema, StrategyStatSchema, TaskIdSchema, ValidatedFactSchema } from "./common";
import { StrategyDecisionSchema } from "./decision";
import { RuntimeStateSchema, RoundLifecycleSchema, StopTriggerSchema, StrategySchema, TerminalReasonSchema } from "./enums";
import { EvaluationResultSchema } from "./evaluation";
import { GoalCoreSchema } from "./goal";

export const RoundProjectionSchema = z.object({
  task_id: TaskIdSchema,
  goal_id: GoalIdSchema,
  round_id: RoundIdSchema,
  ordinal: z.number().int().positive(),
  strategy: StrategySchema,
  task_slice: z.string(),
  instructions: z.array(z.string()),
  lifecycle: RoundLifecycleSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  backend_result: BackendResultSchema.optional(),
  evaluation: EvaluationResultSchema.optional(),
  decision: StrategyDecisionSchema.optional()
});

export const TaskProjectionSchema = z.object({
  task_id: TaskIdSchema,
  goal: GoalCoreSchema,
  backend_id: z.string(),
  runtime_state: RuntimeStateSchema,
  terminal_reason: TerminalReasonSchema.optional(),
  stop_trigger: StopTriggerSchema.optional(),
  active_round_id: RoundIdSchema.optional(),
  current_strategy: StrategySchema.optional(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  best_known_state: BestKnownStateSchema,
  loop_state: LoopStateSchema
});

export const ProjectionSnapshotSchema = z.object({
  task: TaskProjectionSchema,
  rounds: z.array(RoundProjectionSchema),
  failure_patterns: z.array(FailurePatternSchema),
  validated_facts: z.array(ValidatedFactSchema),
  strategy_stats: z.array(StrategyStatSchema),
  artifacts: z.array(ArtifactMetadataSchema)
});

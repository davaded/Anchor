import { z } from "zod";
import { BackendResultSchema } from "./backend";
import { GoalIdSchema, EventIdSchema, IsoDateTimeSchema, RoundIdSchema, TaskIdSchema } from "./common";
import { StrategyDecisionSchema } from "./decision";
import { EventTypeSchema, StrategySchema } from "./enums";
import { EvaluationResultSchema } from "./evaluation";
import { GoalCoreSchema } from "./goal";
import { TerminalResultSchema } from "./terminal";

export const RoundInputSchema = z.object({
  task_id: TaskIdSchema,
  goal_id: GoalIdSchema,
  round_id: RoundIdSchema,
  strategy: StrategySchema,
  task_slice: z.string(),
  instructions: z.array(z.string()),
  constraints: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  context: z.object({
    relevant_files: z.array(z.string()).optional(),
    latest_failure_summary: z.array(z.string()).optional(),
    validated_facts: z.array(z.string()).optional()
  }).default({})
});

const BaseEventSchema = z.object({
  event_id: EventIdSchema,
  task_id: TaskIdSchema,
  goal_id: GoalIdSchema,
  round_id: RoundIdSchema.optional(),
  occurred_at: IsoDateTimeSchema
});

export const GoalStartedEventSchema = BaseEventSchema.extend({
  type: z.literal("goal_started"),
  payload: z.object({
    goal: GoalCoreSchema,
    backend_id: z.string(),
    cwd: z.string().optional()
  })
});

export const RoundBuiltEventSchema = BaseEventSchema.extend({
  type: z.literal("round_built"),
  payload: z.object({
    round: RoundInputSchema
  })
});

export const RoundDispatchedEventSchema = BaseEventSchema.extend({
  type: z.literal("round_dispatched"),
  payload: z.object({
    round_id: RoundIdSchema,
    backend_id: z.string()
  })
});

export const BackendResultRecordedEventSchema = BaseEventSchema.extend({
  type: z.literal("backend_result_recorded"),
  payload: z.object({
    result: BackendResultSchema
  })
});

export const EvaluationRecordedEventSchema = BaseEventSchema.extend({
  type: z.literal("evaluation_recorded"),
  payload: z.object({
    evaluation: EvaluationResultSchema
  })
});

export const DecisionRecordedEventSchema = BaseEventSchema.extend({
  type: z.literal("decision_recorded"),
  payload: z.object({
    decision: StrategyDecisionSchema
  })
});

const TerminalPayloadSchema = z.object({
  terminal: TerminalResultSchema
});

export const TaskCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal("task_completed"),
  payload: TerminalPayloadSchema
});

export const TaskPartiallyReturnedEventSchema = BaseEventSchema.extend({
  type: z.literal("task_partially_returned"),
  payload: TerminalPayloadSchema
});

export const TaskStoppedEventSchema = BaseEventSchema.extend({
  type: z.literal("task_stopped"),
  payload: TerminalPayloadSchema
});

export const TaskErroredEventSchema = BaseEventSchema.extend({
  type: z.literal("task_errored"),
  payload: TerminalPayloadSchema
});

export const AnchorEventSchema = z.discriminatedUnion("type", [
  GoalStartedEventSchema,
  RoundBuiltEventSchema,
  RoundDispatchedEventSchema,
  BackendResultRecordedEventSchema,
  EvaluationRecordedEventSchema,
  DecisionRecordedEventSchema,
  TaskCompletedEventSchema,
  TaskPartiallyReturnedEventSchema,
  TaskStoppedEventSchema,
  TaskErroredEventSchema
]);

export const eventSchemas = {
  goal_started: GoalStartedEventSchema,
  round_built: RoundBuiltEventSchema,
  round_dispatched: RoundDispatchedEventSchema,
  backend_result_recorded: BackendResultRecordedEventSchema,
  evaluation_recorded: EvaluationRecordedEventSchema,
  decision_recorded: DecisionRecordedEventSchema,
  task_completed: TaskCompletedEventSchema,
  task_partially_returned: TaskPartiallyReturnedEventSchema,
  task_stopped: TaskStoppedEventSchema,
  task_errored: TaskErroredEventSchema
} satisfies Record<z.infer<typeof EventTypeSchema>, z.ZodTypeAny>;

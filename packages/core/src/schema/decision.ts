import { z } from "zod";
import { GoalIdSchema, RoundIdSchema, TaskIdSchema } from "./common";
import { StopTriggerSchema, StrategySchema, TerminalReasonSchema } from "./enums";

export const StrategyDecisionSchema = z.object({
  task_id: TaskIdSchema,
  goal_id: GoalIdSchema,
  round_id: RoundIdSchema,
  decision: StrategySchema,
  reason: z.string(),
  next_strategy: StrategySchema.optional(),
  next_instructions: z.array(z.string()).default([]),
  terminal_reason: TerminalReasonSchema.optional(),
  stop_trigger: StopTriggerSchema.optional()
});

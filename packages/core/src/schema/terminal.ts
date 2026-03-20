import { z } from "zod";
import { BestKnownStateSchema, GoalIdSchema, TaskIdSchema } from "./common";
import { StopTriggerSchema, TerminalReasonSchema } from "./enums";

export const TerminalResultSchema = z.object({
  task_id: TaskIdSchema,
  goal_id: GoalIdSchema,
  terminal_reason: TerminalReasonSchema,
  stop_trigger: StopTriggerSchema.optional(),
  summary: z.string(),
  best_known_state: BestKnownStateSchema,
  completed_at: z.string().datetime()
});

import { z } from "zod";
import { GoalIdSchema } from "./common";

export const StopPolicySchema = z.object({
  max_rounds: z.number().int().positive().default(6),
  max_same_failure: z.number().int().positive().default(2),
  allow_partial: z.boolean().default(true),
  budget_limit_ms: z.number().int().positive().optional()
});

export const GoalInputSchema = z.object({
  goal: z.string().min(1),
  constraints: z.array(z.string()).default([]),
  success_criteria: z.array(z.string()).default([]),
  stop_policy: StopPolicySchema.default({
    max_rounds: 6,
    max_same_failure: 2,
    allow_partial: true
  }),
  cwd: z.string().optional()
});

export const GoalCoreSchema = GoalInputSchema.extend({
  goal_id: GoalIdSchema
});

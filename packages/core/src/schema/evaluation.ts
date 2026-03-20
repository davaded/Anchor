import { z } from "zod";
import { FailedCheckSchema, GoalIdSchema, LoopStateSchema, RoundIdSchema, TaskIdSchema, ValidatedFactSchema } from "./common";
import { SeveritySchema } from "./enums";

export const EvaluationResultSchema = z.object({
  task_id: TaskIdSchema,
  goal_id: GoalIdSchema,
  round_id: RoundIdSchema,
  pass: z.boolean(),
  failed_checks: z.array(FailedCheckSchema),
  resolved_checks: z.array(z.string()),
  regressions: z.array(z.string()),
  severity: SeveritySchema,
  evaluation_summary: z.string(),
  failure_fingerprint: z.array(z.string()),
  repeated_fingerprint_count: z.number().int().nonnegative(),
  loop_state: LoopStateSchema,
  validated_facts: z.array(ValidatedFactSchema),
  invalidated_fact_ids: z.array(z.string()),
  hard_constraint_violation: z.boolean()
});

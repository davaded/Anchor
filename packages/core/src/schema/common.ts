import { z } from "zod";
import { ArtifactTypeSchema, LoopLevelSchema, SeveritySchema, StrategySchema, TrustTierSchema, ValidatedFactKindSchema } from "./enums";

export const TaskIdSchema = z.string().regex(/^task_[0-9A-HJKMNP-TV-Z]+$/);
export const GoalIdSchema = z.string().regex(/^goal_[0-9A-HJKMNP-TV-Z]+$/);
export const EventIdSchema = z.string().regex(/^event_[0-9A-HJKMNP-TV-Z]+$/);
export const RoundIdSchema = z.string().regex(/^round_[1-9][0-9]*$/);
export const ArtifactIdSchema = z.string().regex(/^artifact_[0-9A-HJKMNP-TV-Z]+$/);
export const IsoDateTimeSchema = z.string().datetime();

export const BestKnownStateSchema = z.object({
  summary: z.string(),
  validated_items: z.array(z.string()),
  unresolved_items: z.array(z.string()),
  last_meaningful_round: RoundIdSchema.optional()
});

export const LoopStateSchema = z.object({
  loop_level: LoopLevelSchema,
  evidence: z.array(z.string()),
  repeat_count: z.number().int().nonnegative(),
  active_fingerprint_key: z.string().optional()
});

export const ArtifactMetadataSchema = z.object({
  artifact_id: ArtifactIdSchema,
  task_id: TaskIdSchema,
  round_id: RoundIdSchema.optional(),
  event_id: EventIdSchema,
  type: ArtifactTypeSchema,
  producer: z.string(),
  path: z.string(),
  hash: z.string(),
  size: z.number().int().nonnegative(),
  created_at: IsoDateTimeSchema
});

export const FailedCheckSchema = z.object({
  type: z.enum(["missing", "invalid", "misaligned", "superficial", "regressive", "stuck"]),
  code: z.string(),
  detail: z.string(),
  trust_tier: TrustTierSchema.default("derived")
});

export const ValidatedFactSchema = z.object({
  id: z.string().regex(/^vf_[0-9A-HJKMNP-TV-Z]+$/),
  task_id: TaskIdSchema,
  round_id: RoundIdSchema,
  kind: ValidatedFactKindSchema,
  statement: z.string(),
  confidence: SeveritySchema,
  still_valid: z.boolean()
});

export const FailurePatternSchema = z.object({
  task_id: TaskIdSchema,
  fingerprint_key: z.string(),
  failure_fingerprint: z.array(z.string()),
  first_seen_round: RoundIdSchema,
  last_seen_round: RoundIdSchema,
  seen_count: z.number().int().positive(),
  strategies_seen: z.array(StrategySchema),
  latest_severity: SeveritySchema,
  latest_details: z.array(z.string()),
  suspected_scope: z.enum(["narrow", "medium", "broad"])
});

export const StrategyStatSchema = z.object({
  task_id: TaskIdSchema,
  strategy: StrategySchema,
  attempts: z.number().int().nonnegative(),
  passes: z.number().int().nonnegative(),
  partials: z.number().int().nonnegative(),
  stop_caused: z.number().int().nonnegative(),
  repeated_failure_count: z.number().int().nonnegative(),
  last_used_round: RoundIdSchema.optional()
});

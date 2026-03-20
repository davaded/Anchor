import { z } from "zod";
import { ArtifactTypeSchema, BackendStatusSchema, TrustTierSchema } from "./enums";
import { GoalIdSchema, IsoDateTimeSchema, RoundIdSchema, TaskIdSchema } from "./common";

export const BackendCapabilitiesSchema = z.object({
  read_files: z.boolean(),
  write_files: z.boolean(),
  run_commands: z.boolean(),
  use_tools: z.boolean(),
  structured_patch_output: z.boolean(),
  supports_interruption: z.boolean(),
  supports_stream_events: z.boolean()
});

export const BackendDescriptorSchema = z.object({
  backend_id: z.string(),
  backend_label: z.string(),
  backend_version: z.string().optional(),
  adapter_version: z.string(),
  execution_mode: z.string(),
  capabilities: BackendCapabilitiesSchema
});

export const CommandRecordSchema = z.object({
  command: z.string(),
  exit_code: z.number().int().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  status: z.enum(["completed", "failed", "timed_out", "unknown"]),
  trust_tier: TrustTierSchema
});

export const FileChangeRecordSchema = z.object({
  path: z.string(),
  change_type: z.enum(["created", "modified", "deleted", "read"]),
  trust_tier: TrustTierSchema
});

export const BackendBlockerSchema = z.object({
  code: z.string(),
  detail: z.string(),
  retryable: z.boolean(),
  trust_tier: TrustTierSchema
});

export const ArtifactRefSchema = z.object({
  type: ArtifactTypeSchema,
  ref: z.string()
});

export const TrustedEvidenceSchema = z.object({
  process_exit_code: z.number().int().nullable().optional(),
  started_at: IsoDateTimeSchema.optional(),
  finished_at: IsoDateTimeSchema.optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  execution_confirmed: z.boolean().default(true),
  binary_path: z.string().optional()
});

export const DerivedEvidenceSchema = z.object({
  files: z.array(FileChangeRecordSchema).default([]),
  commands: z.array(CommandRecordSchema).default([]),
  blockers: z.array(BackendBlockerSchema).default([]),
  constraint_violations: z.array(z.string()).default([])
});

export const SelfReportedEvidenceSchema = z.object({
  summary: z.string().default(""),
  notes: z.array(z.string()).default([]),
  claims: z.array(z.string()).default([])
});

export const BackendResultSchema = z.object({
  task_id: TaskIdSchema,
  goal_id: GoalIdSchema,
  round_id: RoundIdSchema,
  backend: BackendDescriptorSchema,
  status: BackendStatusSchema,
  trusted: TrustedEvidenceSchema,
  derived: DerivedEvidenceSchema,
  self_reported: SelfReportedEvidenceSchema,
  artifacts: z.array(ArtifactRefSchema).default([]),
  raw_ref: z.string().optional()
});

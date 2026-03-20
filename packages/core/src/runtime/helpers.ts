import type { BackendResult, RoundInput } from "../types";

export function determineScope(files: BackendResult["derived"]["files"]): "narrow" | "medium" | "broad" {
  if (files.length <= 2) return "narrow";
  if (files.length <= 5) return "medium";
  return "broad";
}

export function buildFailureFingerprint(
  failedChecks: Array<{ type: string; code: string }>,
  scope: "narrow" | "medium" | "broad"
): string[] {
  const base = failedChecks.map((item) => `${item.type}:${item.code}`);
  base.push(`scope:${scope}`);
  return base;
}

export function fingerprintKey(fingerprint: string[]): string {
  return fingerprint.join("|");
}

export function serializeRoundInput(input: RoundInput): string {
  const lines: string[] = [];
  lines.push(`Goal ID: ${input.goal_id}`);
  lines.push(`Round ID: ${input.round_id}`);
  lines.push(`Strategy: ${input.strategy}`);
  lines.push(`Task Slice: ${input.task_slice}`);
  if (input.constraints.length > 0) {
    lines.push("Constraints:");
    input.constraints.forEach((constraint) => lines.push(`- ${constraint}`));
  }
  if (input.context.relevant_files?.length) {
    lines.push("Relevant Files:");
    input.context.relevant_files.forEach((file) => lines.push(`- ${file}`));
  }
  if (input.context.latest_failure_summary?.length) {
    lines.push("Latest Failure Summary:");
    input.context.latest_failure_summary.forEach((item) => lines.push(`- ${item}`));
  }
  if (input.context.validated_facts?.length) {
    lines.push("Validated Facts:");
    input.context.validated_facts.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("Instructions:");
  input.instructions.forEach((instruction) => lines.push(`- ${instruction}`));
  return lines.join("\n");
}

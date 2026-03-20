import { monotonicFactory } from "ulid";

const nextUlid = monotonicFactory();

export function nowIso(): string {
  return new Date().toISOString();
}

export function createTaskId(): string {
  return `task_${nextUlid()}`;
}

export function createGoalId(): string {
  return `goal_${nextUlid()}`;
}

export function createEventId(): string {
  return `event_${nextUlid()}`;
}

export function createArtifactId(): string {
  return `artifact_${nextUlid()}`;
}

export function createValidatedFactId(): string {
  return `vf_${nextUlid()}`;
}

export function createRoundId(ordinal: number): string {
  return `round_${ordinal}`;
}

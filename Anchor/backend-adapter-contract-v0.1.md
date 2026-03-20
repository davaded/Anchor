# Anchor Backend Adapter Contract v0.1

## Purpose

This document defines the contract between Anchor runtime and any execution backend.

Anchor is backend-agnostic only if every backend can be normalized into the same lifecycle and result shape.
This adapter contract is the layer that enforces that normalization.

---

## Adapter Responsibilities

An Anchor backend adapter must:

- accept normalized `RoundInput`
- invoke a specific backend execution method
- normalize backend output into `BackendResult`
- expose backend capability metadata
- distinguish task failure from transport / adapter failure
- preserve raw backend references for audit or replay

An adapter must not:

- make control decisions on behalf of Anchor
- silently drop backend blockers
- claim success without emitting execution evidence
- rewrite stop policy

---

## Required Adapter Interface

```ts
type BackendStatus =
  | "completed"
  | "failed"
  | "blocked"
  | "timed_out"
  | "interrupted"

interface BackendCapabilities {
  read_files: boolean
  write_files: boolean
  run_commands: boolean
  use_tools: boolean
  structured_patch_output: boolean
  supports_interruption: boolean
  supports_stream_events: boolean
}

interface BackendDescriptor {
  backend_id: string
  backend_label: string
  backend_version?: string
  adapter_version: string
  execution_mode: string
  capabilities: BackendCapabilities
}

interface CommandRecord {
  command: string
  exit_code?: number
  duration_ms?: number
  status: "completed" | "failed" | "timed_out" | "unknown"
}

interface ToolCallRecord {
  tool_name: string
  status: "completed" | "failed" | "rejected" | "unknown"
  summary?: string
}

interface FileChangeRecord {
  path: string
  change_type: "created" | "modified" | "deleted" | "read"
}

interface ArtifactRef {
  type: "patch" | "log" | "transcript" | "report" | "other"
  ref: string
}

interface BackendBlocker {
  code: string
  detail: string
  retryable: boolean
}

interface BackendResult {
  round_id: string
  backend: BackendDescriptor
  status: BackendStatus
  summary: string
  changes: {
    files: FileChangeRecord[]
    commands: CommandRecord[]
    tools: ToolCallRecord[]
  }
  artifacts: ArtifactRef[]
  blockers: BackendBlocker[]
  notes: string[]
  metrics: {
    started_at?: string
    finished_at?: string
    duration_ms?: number
  }
  raw_ref?: string
}

interface BackendAdapter {
  describe(): BackendDescriptor
  execute(input: RoundInput): Promise<BackendResult>
  interrupt?(round_id: string): Promise<void>
}
```

---

## RoundInput Requirements

The adapter input should be backend-neutral.
At minimum it must include:

```ts
interface RoundInput {
  round_id: string
  goal_id: string
  strategy: string
  task_slice: string
  instructions: string[]
  constraints?: string[]
  context?: {
    relevant_files?: string[]
    latest_failure_summary?: string[]
    validated_facts?: string[]
  }
}
```

Adapter implementations may enrich prompts internally, but they must not mutate the semantic meaning of the round input.

---

## Contract Invariants

Every `BackendResult` must satisfy these invariants:

1. `round_id` must match the input round.
2. `backend` metadata must identify the adapter and execution mode.
3. `status` must describe execution state, not evaluation success.
4. `summary` must be non-empty.
5. All observed blockers must be surfaced in `blockers`.
6. Commands and tool calls may be empty, but must be explicit empty arrays.
7. Missing evidence must not be fabricated.

---

## Status Mapping Rules

Anchor should interpret `BackendResult.status` as follows:

- `completed`: backend finished its attempt and returned a usable result
- `failed`: backend finished, but execution itself failed materially
- `blocked`: backend could not proceed because of missing dependency, permissions, ambiguity, or external limitation
- `timed_out`: backend did not finish within runtime budget
- `interrupted`: execution was intentionally stopped

Important:
`completed` does not imply task success.
It only means the backend finished producing a result that Anchor can evaluate.

---

## Adapter Error Boundary

The adapter should normalize errors into one of two categories:

### Round-level execution failure

Used when the backend attempted work but the task failed.
These should become `BackendResult.status = "failed"` or `"blocked"`.

Examples:

- tests failed
- patch could not be applied
- backend reported missing file
- command exited non-zero

### Runtime-level adapter failure

Used when Anchor cannot trust the adapter contract itself.
These should raise runtime errors, not normal round failures.

Examples:

- malformed adapter payload
- missing `round_id`
- invalid JSON structure from a required normalized interface
- persistence corruption caused by the adapter layer

---

## Capability Negotiation

Anchor should choose strategy with capability awareness.

Examples:

- If `run_commands = false`, avoid strategies that require test verification in-round.
- If `write_files = false`, `patch` and `rewrite_local` should be disallowed.
- If `supports_interruption = false`, manual stop becomes cooperative rather than immediate.
- If `structured_patch_output = true`, evaluation can rely more heavily on artifact parsing.

Capability mismatch should be surfaced as a blocker, not guessed around silently.

---

## Example Normalized Result

```json
{
  "round_id": "r-003",
  "backend": {
    "backend_id": "codex",
    "backend_label": "OpenAI Codex",
    "backend_version": "unknown",
    "adapter_version": "0.1.0",
    "execution_mode": "tool-agent",
    "capabilities": {
      "read_files": true,
      "write_files": true,
      "run_commands": true,
      "use_tools": true,
      "structured_patch_output": false,
      "supports_interruption": true,
      "supports_stream_events": false
    }
  },
  "status": "completed",
  "summary": "Updated auth refresh handling and ran targeted tests.",
  "changes": {
    "files": [
      {
        "path": "src/auth/refresh.ts",
        "change_type": "modified"
      },
      {
        "path": "tests/auth/refresh.test.ts",
        "change_type": "modified"
      }
    ],
    "commands": [
      {
        "command": "pnpm test tests/auth/refresh.test.ts",
        "exit_code": 1,
        "duration_ms": 8642,
        "status": "failed"
      }
    ],
    "tools": []
  },
  "artifacts": [
    {
      "type": "patch",
      "ref": "patch://r-003"
    }
  ],
  "blockers": [],
  "notes": [
    "Expired-session case still failing."
  ],
  "metrics": {
    "duration_ms": 12031
  },
  "raw_ref": "transcript://r-003"
}
```

---

## Evaluation Handoff

The evaluation layer should consume normalized `BackendResult`, plus goal constraints and current memory snapshot.

Evaluation should not parse backend-specific transcripts directly unless it is following `raw_ref` as an optional forensic path.
The normalized result is the primary contract.

---

## Minimal Implementation Rule

Anchor MVP does not need a fully universal adapter ecosystem.
It does need one hard rule:

**Every backend must be lossy in the same direction.**

That means:

- backend-specific details may be omitted
- but omitted details must not change control decisions

If a backend cannot provide enough evidence to preserve the control semantics, it is not yet compatible with Anchor.

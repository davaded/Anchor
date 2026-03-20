# Anchor Memory Schema v0.1

## Purpose

This document defines the persistent memory model used by Anchor runtime.

Anchor memory is not a chat transcript.
It is a compact control ledger that preserves enough structure to answer:

- what has already been tried
- what failed
- what was validated
- what is repeating
- what the best-known state currently is

---

## Memory Design Goals

Anchor memory should be:

- append-friendly
- queryable by round, strategy, and failure fingerprint
- compact enough to survive long task horizons
- explicit about validated progress, not only failures
- backend-neutral

---

## Top-Level Memory Object

```ts
interface AnchorMemory {
  goal: GoalSnapshot
  rounds: RoundRecord[]
  failure_patterns: FailurePattern[]
  validated_facts: ValidatedFact[]
  strategy_stats: StrategyStat[]
  current_loop_state: LoopState
  best_known_state: BestKnownState
}
```

---

## Goal Snapshot

```ts
interface GoalSnapshot {
  goal_id: string
  goal: string
  constraints: string[]
  success_criteria: string[]
  stop_policy: {
    max_rounds: number
    max_same_failure: number
    allow_partial: boolean
  }
  created_at: string
}
```

This is copied from `GoalCore` and treated as immutable for a single runtime session.

---

## Round Record

`RoundRecord` is the canonical per-round ledger entry.

```ts
interface RoundRecord {
  round_id: string
  ordinal: number
  strategy: string
  task_slice: string
  backend_id: string
  backend_status: "completed" | "failed" | "blocked" | "timed_out" | "interrupted"
  evaluation_pass: boolean
  severity: "low" | "medium" | "high"
  failed_checks: FailedCheck[]
  resolved_checks: string[]
  regressions: string[]
  blockers: string[]
  failure_fingerprint: string[]
  repeated_fingerprint_count: number
  notes: string[]
  created_at: string
}

interface FailedCheck {
  type: "missing" | "invalid" | "misaligned" | "superficial" | "regressive" | "stuck"
  code: string
  detail: string
}
```

Required rule:
every round must produce one `RoundRecord`, even for timeout or interruption.

---

## Failure Pattern

Failure patterns are the deduplicated memory layer above raw rounds.

```ts
interface FailurePattern {
  fingerprint_key: string
  failure_fingerprint: string[]
  first_seen_round: string
  last_seen_round: string
  seen_count: number
  strategies_seen: string[]
  latest_severity: "low" | "medium" | "high"
  latest_details: string[]
  suspected_scope: "narrow" | "medium" | "broad"
}
```

### Fingerprint Construction

Recommended fingerprint material:

- failed check `type`
- failed check `code`
- normalized scope marker when known

Example:

```text
invalid:TEST_FAILURE|superficial:PARTIAL_FIX|scope:narrow
```

Do not include unstable natural-language details in the canonical fingerprint key.

---

## Validated Fact

Anchor must remember verified progress, not only failure.

```ts
interface ValidatedFact {
  id: string
  kind: "constraint_satisfied" | "behavior_validated" | "regression_absent" | "artifact_verified"
  statement: string
  source_round: string
  confidence: "low" | "medium" | "high"
  still_valid: boolean
}
```

Examples:

- public API contract preserved
- token refresh happy path passes
- unrelated files untouched

If a later round invalidates a fact, set `still_valid = false`; do not silently delete history.

---

## Strategy Stat

Anchor should track outcome by strategy to avoid repeating exhausted methods blindly.

```ts
interface StrategyStat {
  strategy: string
  attempts: number
  passes: number
  partials: number
  stop_caused: number
  repeated_failure_count: number
  last_used_round?: string
}
```

This supports decisions like:

- patch has been used three times with the same fingerprint
- rewrite_local has not yet been attempted

---

## Best Known State

Best-known state is the concise user-facing reconstruction of current progress.

```ts
interface BestKnownState {
  summary: string
  validated_items: string[]
  unresolved_items: string[]
  last_meaningful_round?: string
}
```

This is what Anchor should return on `stop` or `return_partial`.

---

## Loop State

```ts
interface LoopState {
  loop_level: "none" | "mild" | "severe"
  evidence: string[]
  repeat_count: number
  active_fingerprint_key?: string
}
```

Recommended computation:

- `none`: no recent repeated fingerprint
- `mild`: same fingerprint seen 2 times in the last 3 rounds
- `severe`: same fingerprint seen 3 times, or 2 times with regression, or same strategy repeated past policy threshold

---

## Persistence Rules

Anchor memory should follow these rules:

1. Append the new `RoundRecord`.
2. Upsert the corresponding `FailurePattern`.
3. Upsert `ValidatedFact` entries resolved in this round.
4. Mark invalidated facts as `still_valid = false`.
5. Update `StrategyStat`.
6. Recompute `current_loop_state`.
7. Recompute `best_known_state`.

Memory update must be atomic from the runtime's perspective.
If partial writes occur, the runtime should transition to `errored`.

---

## Minimal JSON Example

```json
{
  "goal": {
    "goal_id": "task-001",
    "goal": "Implement the feature described in issue #123",
    "constraints": [
      "Do not modify public API contracts",
      "Keep changes within the auth module"
    ],
    "success_criteria": [
      "Feature behavior is implemented",
      "Relevant tests pass"
    ],
    "stop_policy": {
      "max_rounds": 6,
      "max_same_failure": 2,
      "allow_partial": true
    },
    "created_at": "2026-03-20T10:00:00Z"
  },
  "rounds": [
    {
      "round_id": "r-003",
      "ordinal": 3,
      "strategy": "patch",
      "task_slice": "Fix the failing auth refresh flow without changing public API",
      "backend_id": "codex",
      "backend_status": "completed",
      "evaluation_pass": false,
      "severity": "medium",
      "failed_checks": [
        {
          "type": "invalid",
          "code": "TEST_FAILURE",
          "detail": "Expired-session test still fails"
        },
        {
          "type": "superficial",
          "code": "PARTIAL_FIX",
          "detail": "Failure path remains incomplete"
        }
      ],
      "resolved_checks": [
        "Previous API contract violation is no longer present"
      ],
      "regressions": [],
      "blockers": [],
      "failure_fingerprint": [
        "invalid:TEST_FAILURE",
        "superficial:PARTIAL_FIX"
      ],
      "repeated_fingerprint_count": 2,
      "notes": [
        "Patch improved contract safety but did not finish the target behavior."
      ],
      "created_at": "2026-03-20T10:08:10Z"
    }
  ],
  "failure_patterns": [
    {
      "fingerprint_key": "invalid:TEST_FAILURE|superficial:PARTIAL_FIX|scope:narrow",
      "failure_fingerprint": [
        "invalid:TEST_FAILURE",
        "superficial:PARTIAL_FIX"
      ],
      "first_seen_round": "r-002",
      "last_seen_round": "r-003",
      "seen_count": 2,
      "strategies_seen": [
        "patch"
      ],
      "latest_severity": "medium",
      "latest_details": [
        "Expired-session test still fails",
        "Failure path remains incomplete"
      ],
      "suspected_scope": "narrow"
    }
  ],
  "validated_facts": [
    {
      "id": "vf-001",
      "kind": "constraint_satisfied",
      "statement": "Public API contract preserved",
      "source_round": "r-003",
      "confidence": "high",
      "still_valid": true
    }
  ],
  "strategy_stats": [
    {
      "strategy": "patch",
      "attempts": 2,
      "passes": 0,
      "partials": 0,
      "stop_caused": 0,
      "repeated_failure_count": 1,
      "last_used_round": "r-003"
    }
  ],
  "current_loop_state": {
    "loop_level": "mild",
    "evidence": [
      "Same fingerprint repeated across two rounds",
      "Patch used twice without full resolution"
    ],
    "repeat_count": 2,
    "active_fingerprint_key": "invalid:TEST_FAILURE|superficial:PARTIAL_FIX|scope:narrow"
  },
  "best_known_state": {
    "summary": "Auth refresh path is partially improved, but expired-session handling remains unresolved.",
    "validated_items": [
      "Public API contract preserved"
    ],
    "unresolved_items": [
      "Expired-session test still fails",
      "Failure path still incomplete"
    ],
    "last_meaningful_round": "r-003"
  }
}
```

---

## Practical Constraints

- Do not store full transcripts in primary memory.
- Store transcript or artifact references outside the core memory ledger.
- Keep `failed_checks.detail` human-readable, but keep fingerprints machine-stable.
- Do not let "latest summary" overwrite validated facts from earlier rounds.

---

## Minimal Query Surface

Anchor runtime should be able to answer these queries without replaying transcripts:

- What strategy was used last round?
- Which failure fingerprint is currently repeating?
- Which validated facts are still trusted?
- Has this exact pattern already survived patch attempts?
- What is the best-known state if the runtime stops now?

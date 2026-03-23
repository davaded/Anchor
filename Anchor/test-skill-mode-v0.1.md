# Anchor Test Skill Mode v0.1

## Purpose

This document defines the skill-facing verification mode for Anchor.

`anchor test [target]` is the primary user entrypoint for validating completed or in-progress work, reporting problems, waiting for user approval, then performing confirmed repair and regression.

This mode is independent from goal mode.
It should not be implemented as a flag or sub-behavior inside `anchor goal`.

---

## Command Shape

```text
anchor test [target]
```

Examples:

- `anchor test`
- `anchor test current work`
- `anchor test user login`
- `anchor test payment flow`

When `target` is omitted, Anchor should resolve it as `current work`.

In skill mode, `target` is natural language.
The user should not need to provide `cwd`, explicit test targets, or repository path flags during the normal flow.

---

## Why This Mode Exists

Goal mode is strong at pushing implementation forward.
It is weaker at proving whether the resulting work is actually safe and complete.

Test skill mode closes that gap by enforcing a different control philosophy:

- verify before acting
- diagnose before modifying
- wait for user approval before repair
- require regression after repair

Test mode answers one question:

> What evidence shows whether this target works, what is broken, and how should it be repaired?

---

## Relationship to Goal Mode

Goal mode and test mode are peers.

`anchor goal [target]`
- implementation-oriented
- optimizes for progress

`anchor test [target]`
- verification-oriented
- optimizes for evidence, diagnosis, and controlled repair

Goal mode must not silently become test mode.
Test mode must not silently become goal mode.

---

## Core Principles

### Evidence before action

Anchor should test and inspect first.
It should not repair code before establishing a verification baseline.

### Diagnosis before modification

Detected failures should be converted into a report with evidence, scope, and candidate repair options before code changes begin.

### Approval before repair

Repair is not automatic.
The user must approve a repair path in the same conversation.

### Regression after repair

A repair is not done when the code changes compile.
It is done when relevant regression checks pass.

### Green does not mean bug-free

When tests pass, Anchor may say that no failure was detected within the current verification scope.
It must not claim absolute correctness.

---

## Ambient Skill Context

When resolving `anchor test [target]`, Anchor should use:

1. explicit user target text
2. current workspace
3. current uncommitted changes
4. related modules and existing tests
5. prior conversation context about the feature under test

When `target = current work`, the default verification scope should prioritize the current diff and its likely blast radius.

---

## Verification Skill Object

Test skill mode should resolve the user request into a stable object:

```json
{
  "verification_id": "verify_001",
  "target": "current work",
  "scope_assumptions": [
    "Focus on current workspace changes first",
    "Prefer targeted and module-level tests before wider regression"
  ],
  "verification_policy": {
    "target_inference": "current_changes",
    "test_layers": [
      "targeted",
      "module",
      "smoke"
    ],
    "allow_test_creation": true,
    "allow_code_fix_after_approval": true,
    "report_only": false
  },
  "cwd": "/repo/path"
}
```

This object is parallel to goal mode.
It should not be collapsed into `GoalCore`.

---

## User-Facing Lifecycle

Test skill mode has seven top-level stages:

1. Target Resolution
2. Test Strategy
3. Verification Execution
4. Diagnosis Report
5. User Approval
6. Approved Repair
7. Regression

### 1. Target Resolution

Anchor resolves the verification target and verification scope.

Possible outcomes:

- target resolved cleanly
- target resolved with explicit assumptions
- verification blocked by missing target clarity

### 2. Test Strategy

Anchor determines how verification should be performed.

This includes:

- which existing tests to run first
- whether module-level or smoke tests are needed
- whether a minimal executable test should be added because no test oracle exists
- what the current coverage gaps are

### 3. Verification Execution

Anchor executes the selected verification plan and records evidence.

Evidence should include:

- commands run
- pass and fail outcomes
- key errors
- blocked checks
- uncovered areas

### 4. Diagnosis Report

Failures are transformed into structured issues before repair begins.

Each issue should include:

- issue identifier
- problem summary
- impact
- evidence
- suspected root causes
- confidence
- candidate repair options
- recommended option

### 5. User Approval

After the report is produced, Anchor must stop and wait.

Allowed user replies include natural-language confirmations such as:

- `apply the recommended fixes`
- `fix issue 2 only`
- `issue 1 with A, issue 2 with B`
- `do not fix yet`

No separate `anchor fix` command is required in the normal skill flow.

### 6. Approved Repair

Anchor repairs only the approved issues using the approved options.

It should avoid widening scope unless a new user checkpoint is triggered.

### 7. Regression

After repair, Anchor must run regression checks.

Regression should cover at least:

- directly related checks
- affected module checks
- critical smoke path where appropriate

---

## Output Contract

The first report produced by `anchor test [target]` should contain four sections:

1. Test Strategy
2. Execution Result
3. Issue Report
4. Fix Options

Suggested reply prompt:

```text
Reply with what you want next:
- apply the recommended fixes
- fix issue 1 only
- issue 1 with A, issue 2 with B
- do not fix yet, keep the report
```

After approved repair, the final output should contain:

1. Applied Repair
2. Regression Result
3. Residual Risk
4. Remaining Coverage Gaps

---

## State Model

Test skill mode should expose these high-level states:

- `resolving_target`
- `planning_verification`
- `running_verification`
- `diagnosing`
- `waiting_for_user_decision`
- `applying_fix`
- `running_regression`
- `completed`
- `completed_with_residual_risk`
- `blocked`
- `errored`

Suggested terminal outcomes:

- `issues_detected`
- `no_failure_detected`
- `insufficient_test_oracle`
- `verification_blocked`
- `fixed_and_regressed`
- `fix_applied_with_residual_risk`
- `regression_failed`

---

## Verification Evidence Model

Verification evidence should be preserved as a first-class output:

```json
{
  "commands": [
    {
      "command": "pnpm test auth",
      "status": "failed"
    }
  ],
  "passed_checks": [
    "password validation"
  ],
  "failed_checks": [
    "session persistence"
  ],
  "blocked_checks": [],
  "coverage_gaps": [
    "third-party login flow"
  ]
}
```

Evidence is the primary basis for diagnosis and repair approval.
Backend self-report alone is not sufficient.

---

## Issue Report Model

Each detected issue should have a stable structure:

```json
{
  "issue_id": "issue_001",
  "title": "Session persistence broken after login",
  "severity": "high",
  "impact": "Users appear logged out after refresh",
  "evidence": [
    "Login integration test fails after redirect"
  ],
  "suspected_root_causes": [
    {
      "summary": "Session write path no longer persists the expected field",
      "confidence": 0.72
    }
  ],
  "fix_options": [
    {
      "option_id": "A",
      "summary": "Apply the smallest local persistence fix",
      "risk_level": "medium"
    },
    {
      "option_id": "B",
      "summary": "Unify the session serialization path",
      "risk_level": "low"
    }
  ],
  "recommended_option": "B"
}
```

Root cause entries should be treated as hypotheses unless directly proven.

---

## Required User Gate

The approval gate is mandatory.

Anchor must not:

- auto-fix after detecting issues
- silently pick a repair option for the user
- blur diagnosis output into repair output

This is the main control feature of test skill mode.

---

## Insufficient Oracle Rule

If no reliable test oracle exists, Anchor should prefer one of two outcomes:

1. create or propose a minimal executable test if policy allows it
2. stop with `insufficient_test_oracle`

Anchor must not pretend verification happened when no executable basis existed.

---

## Boundaries

Test skill mode must not:

- declare absolute correctness after a green run
- repair code before user approval
- hide coverage gaps
- collapse issue diagnosis into a single opaque summary
- silently widen repair scope beyond the approved plan

Test skill mode may:

- infer the relevant verification scope
- create minimal executable tests when needed and allowed
- recommend a preferred fix option

---

## Example Interaction

```text
User: anchor test current work

Anchor:
- I will infer the current change scope, build a verification strategy, run the checks, then report issues and repair options.
- I will not change code before you approve a repair path.
```

After verification:

```text
Verification result: issues_detected

Issue 1: session persistence broken
Recommended option: B

Issue 2: rememberMe null handling bug
Recommended option: A

Reply with:
- apply the recommended fixes
- fix issue 1 only
- issue 1 with B, issue 2 with A
- do not fix yet
```

---

## Success Condition

Test skill mode is considered complete when Anchor can take a natural-language verification request, produce a structured evidence-backed report, wait for user approval, then perform confirmed repair and regression without requiring a separate user-visible fix command.

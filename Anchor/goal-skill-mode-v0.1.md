# Anchor Goal Skill Mode v0.1

## Purpose

This document defines the skill-facing goal mode for Anchor.

`anchor goal [target]` is the primary user entrypoint for goal-driven execution when Anchor is installed as a Codex or Claude Code skill.

This mode is not a replacement for the existing round protocol.
It is a product-layer contract that explains how goal-driven execution should behave in a skill environment where workspace context, recent changes, and follow-up user replies are available implicitly.

---

## Command Shape

```text
anchor goal [target]
```

Examples:

- `anchor goal user login`
- `anchor goal continue current work`
- `anchor goal repair payment callback`

When `target` is omitted, Anchor should first try to resolve an active task from conversation and workspace context.
If no stable target can be inferred safely, Anchor should ask the user for clarification instead of guessing broadly.

---

## Why This Mode Exists

The core runtime already supports goal-anchored round execution.
Skill mode adds the missing product behavior around that runtime:

- natural-language task entry
- implicit workspace context
- controlled user checkpoints
- readable progress outputs
- skill-native continuation across follow-up replies

Goal mode answers one question:

> What should Anchor do to advance the requested implementation goal?

It does not certify that the result is fully verified.
Quality verification belongs to `anchor test [target]`.

---

## Companion Specifications

Goal skill mode sits above these runtime-level specifications:

- `round-protocol-v0.1.md`
- `execution-state-machine-v0.1.md`
- `backend-adapter-contract-v0.1.md`
- `memory-schema-v0.1.md`

This document defines the skill product behavior.
The companion specifications define the lower-level control runtime.

---

## Core Principles

### Anchor the task, not the prompt

The visible command may be short, but Anchor should resolve it into a stable goal object before execution continues.

### Infer context, but do not infer recklessly

Anchor should use workspace, diff, and conversation context aggressively.
It should not silently widen scope when the target is ambiguous.

### Pause at meaningful decision points

Skill mode should not push through hidden tradeoffs.
When a decision materially changes risk, scope, or output quality, Anchor should stop and ask the user.

### Explain progress in user terms

Outputs should tell the user what Anchor is doing, why it is doing it, and what options exist next.

### Keep goal mode separate from test mode

Goal mode is for implementation progress.
Test mode is for verification, diagnosis, and confirmed repair.

---

## Ambient Skill Context

When resolving `anchor goal [target]`, Anchor should use the following sources in descending priority:

1. explicit user target text
2. active task state in the current conversation
3. recent workspace changes
4. repository structure and likely module ownership
5. known constraints from prior turns

Expected context inputs include:

- current workspace root
- current git status or recent file changes
- repository layout
- known task memory from the current conversation
- prior user approvals or scope constraints

These inputs are skill-native.
They should not need to be typed by the user as CLI flags in the normal flow.

---

## Goal Skill Object

Goal skill mode should resolve the user request into a stable object before passing work to the runtime:

```json
{
  "goal_skill_id": "goal_skill_001",
  "target": "user login",
  "resolved_goal": "Implement the user login flow in the current repository.",
  "scope_assumptions": [
    "Current workspace is the intended target repository",
    "Changes should stay within login-related modules unless approved"
  ],
  "constraints": [
    "Preserve validated behavior outside the target slice"
  ],
  "success_criteria": [
    "Requested implementation behavior is present",
    "No unintended scope expansion is introduced"
  ],
  "cwd": "/repo/path"
}
```

This object may be compiled into the lower-level `GoalCore`, but it exists to preserve skill-facing assumptions and user-readable scope framing.

---

## User-Facing Lifecycle

Goal skill mode has five top-level stages:

1. Target Resolution
2. Scope Framing
3. Controlled Execution
4. Guarded Pause
5. Terminal Outcome

### 1. Target Resolution

Anchor resolves the requested target using ambient skill context.

Possible outcomes:

- target resolved cleanly
- target resolved with assumptions that can be stated explicitly
- target ambiguous and requires user clarification

### 2. Scope Framing

Anchor frames the initial scope before the first execution round.

This includes:

- intended feature or task slice
- initial constraints
- likely affected modules
- known risk of scope expansion

### 3. Controlled Execution

Anchor runs the standard round loop against the selected backend:

`Goal -> Round Input -> Backend Execution -> Evaluation -> Memory Update -> Strategy Decision`

This stage uses the existing runtime behavior defined by the round protocol.

### 4. Guarded Pause

Anchor should pause and ask the user when one of these conditions occurs:

- target or scope is ambiguous
- a strategy switch materially changes implementation shape
- a change would widen scope beyond the original target
- partial return becomes the most justified outcome
- external blockers make continuation uncertain

### 5. Terminal Outcome

Goal mode ends with one of:

- implementation completed
- partial result returned
- execution stopped
- task blocked
- runtime errored

Goal mode may recommend running `anchor test [target]` after a non-trivial implementation, but it should not silently switch into test mode.

---

## User Checkpoints

The following checkpoints are mandatory in skill mode.

### Scope Checkpoint

Triggered when the intended target is under-specified or likely broader than one clear slice.

### Strategy Checkpoint

Triggered when Anchor wants to change method in a way the user might reasonably want to control.

Examples:

- moving from patching to broader rewrite
- touching additional modules not implied by the original request

### Partial Return Checkpoint

Triggered when Anchor can return useful progress but not a justified full completion.

### Blocker Checkpoint

Triggered when continuation depends on missing information, permissions, or external inputs.

---

## Output Contract

Goal skill outputs should remain readable and decision-oriented.

At each significant point, Anchor should communicate:

- current objective
- current task slice
- important assumptions
- progress made
- current blockers or risks
- next available user choices

Suggested terminal output sections:

1. Outcome
2. Scope Applied
3. Progress Summary
4. Known Risks
5. Suggested Next Step

---

## Goal Skill State Model

Goal skill mode adds the following high-level product states above the runtime:

- `resolving_target`
- `framing_scope`
- `running_goal_rounds`
- `waiting_for_user_decision`
- `completed`
- `partial`
- `blocked`
- `stopped`
- `errored`

These states are skill-facing.
The lower-level runtime states remain defined by `execution-state-machine-v0.1.md`.

---

## Boundaries

Goal skill mode must not:

- silently switch into test mode
- silently expand scope across unrelated modules
- claim quality verification without evidence
- assume omitted targets when context is weak
- hide partial delivery behind a success label

Goal skill mode may:

- infer likely target scope from workspace context
- summarize assumptions explicitly
- recommend a follow-up `anchor test [target]`

---

## Example Interaction

```text
User: anchor goal user login

Anchor:
- Resolved target: user login flow
- Initial scope: login form, auth request, session handling
- Constraint: avoid unrelated account settings changes
- Starting controlled execution
```

If a material decision appears later:

```text
Anchor:
The current fix likely requires widening scope into shared session middleware.
Reply to continue, narrow the scope, or stop with the current partial result.
```

---

## Success Condition

Goal skill mode is considered complete when Anchor can act as a natural, conversation-native goal runner on top of the existing runtime without forcing users to provide low-level CLI configuration for normal repository work.

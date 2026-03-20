# Anchor

**Anchor is a backend-agnostic headless control runtime for coding agents.**

Anchor does not replace execution backends like Codex, Claude Code, or other coding agents.  
Instead, it wraps them with a persistent control loop that keeps long-running tasks anchored to a goal, remembers failures across attempts, detects unproductive loops, and switches strategies when needed.

---

## What Anchor Is

Anchor is a **control runtime** for coding agents.

It sits above execution backends and manages:

- **goal anchoring**
- **failure memory**
- **loop detection**
- **strategy switching**
- **stop policy**

Anchor is designed for **long-horizon coding tasks** where agents tend to drift, repeat ineffective actions, or forget why previous attempts failed.

---

## What Anchor Is Not

Anchor is **not**:

- a standalone coding agent
- an IDE
- a terminal UI
- a workflow canvas
- a model provider
- a replacement for Codex, Claude Code, or similar execution backends

Execution belongs to the backend.  
Control belongs to Anchor.

---

## Why Anchor Exists

Modern coding agents are good at execution, but weak at **persistent execution control**.

In long-running tasks, they often:

- lose the original goal
- repeat the same failed pattern
- apply superficial fixes
- drift into local loops
- continue working without meaningful progress

Anchor addresses this by introducing a runtime layer that does not ask:

> “Can the agent do the task?”

but instead asks:

> “Should the task continue this way?”

---

## Core Idea

Anchor treats coding as a sequence of controlled rounds.

Each round consists of:

1. a **goal-anchored input**
2. one backend execution attempt
3. a structured evaluation
4. memory update
5. loop check
6. strategy decision

Instead of blindly retrying until success, Anchor decides whether to:

- continue
- patch
- rewrite locally
- decompose the task
- change method
- stop

---

## Core Components

### Anchor Core
Stores the stable task anchor:
- goal
- constraints
- success criteria
- stop policy

### Anchor Memory
Stores structured failure history:
- what failed
- how it failed
- which method was used
- what patterns are repeating

### Anchor Guard
Detects:
- repeated failures
- unproductive loops
- invalid continuation
- stop conditions

### Anchor Switch
Chooses the next execution mode:
- retry
- patch
- rewrite
- decompose
- change method
- stop

### Execution Backend
The actual coding agent that performs work:
- reading files
- writing code
- running commands
- using tools
- interacting with the repository

Examples:
- Codex
- Claude Code
- Aider
- OpenCode
- Goose
- custom agents

---

## How It Works

Anchor wraps a backend and runs a controlled round loop:

```text
Task -> Anchor Core -> Backend Execution -> Evaluation -> Memory Update -> Guard Check -> Strategy Switch -> Next Round / Stop
```

Anchor does not need to own the interface.  
It can run as a headless runtime behind CLI tools, IDE integrations, or custom agent systems.

---

## Design Principles

- **Anchor the task, not the prompt**
- **Remember failures, don’t retry from amnesia**
- **Detect loops before burning budget**
- **Switch strategy instead of repeating motion**
- **Separate execution from control**
- **Stop when continuation is no longer justified**

---

## Primary Use Cases

Anchor is best suited for:

- long-horizon coding tasks
- multi-step repository changes
- debugging sessions with repeated failed attempts
- migration/refactor flows
- agent-driven implementation with explicit constraints
- systems where execution backend may change, but control policy must remain stable

---

## Minimal Mental Model

Think of Anchor as:

- a **control plane** for coding agents
- a **headless runtime** for persistent task execution
- a **decision layer** above agent execution

If a coding agent is the worker, Anchor is the runtime that decides whether the worker should continue, change tactics, or stop.

---

## Status

Anchor is currently defined as a runtime model with:

- a round-based control loop
- a structured round protocol
- failure memory
- loop detection
- strategy switching

The first implementation target is a backend-agnostic runtime that can wrap existing coding agents without replacing them.

Current spec set:

- `round-protocol-v0.1.md`
- `execution-state-machine-v0.1.md`
- `backend-adapter-contract-v0.1.md`
- `memory-schema-v0.1.md`
- `boundary.md`

---

## Motto

**Keep agents locked on the problem, not lost in the process.**

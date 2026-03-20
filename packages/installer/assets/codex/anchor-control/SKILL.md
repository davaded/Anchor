---
name: anchor-control
description: Use this skill when a coding task should be run through the local Anchor runtime instead of directly through Codex. Trigger it for long-horizon tasks, tasks that need explicit failure memory, or when you want a single goal-oriented control layer.
---

# Anchor Control

## Overview

This skill routes work through the local Anchor runtime and its CLI wrappers.
Use it when task control matters more than one-shot execution.

## Workflow

1. Run `doctor` first:

```powershell
.\scripts\anchor-control.ps1 doctor -Json
```

2. Start a new Anchor-controlled workflow:

```powershell
.\scripts\anchor-control.ps1 goal -Backend codex -Goal "Implement the requested change" -Cwd "D:\repo" -Json
```

3. Capture the returned `task_id` if you need to inspect the underlying runtime later through low-level tooling.

## Trigger Guidance

Use this skill when:

- the task may require multiple attempts
- you need failure memory or loop-aware control
- you want a stable control layer above Codex execution with a single goal-first entrypoint

Do not use this skill for:

- one-shot trivial questions
- direct chat-only brainstorming
- tasks where control is irrelevant

## References

- For exact CLI forms, read `references/cli.md`.
- Use `scripts/anchor-control.ps1` instead of reconstructing low-level runtime commands manually.

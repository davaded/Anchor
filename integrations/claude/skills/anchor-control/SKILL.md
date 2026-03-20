---
name: anchor-control
description: Use this skill when a coding task should be run through the local Anchor runtime instead of directly through Claude Code. Trigger it for long-horizon tasks, tasks that need explicit failure memory, or when you want a single goal-oriented control layer.
---

# Anchor Control

## Overview

This skill routes work through the local Anchor runtime and its CLI wrappers.
Use it when control, recovery, and inspectability matter more than one-shot execution.

Prefer the Node wrapper for cross-platform execution. Use the PowerShell script only as a Windows fallback.

## Workflow

1. Run `doctor` first:

```bash
node ./scripts/anchor-control.mjs doctor --json
```

2. Start a new Anchor-controlled workflow:

```bash
node ./scripts/anchor-control.mjs goal --backend claude --goal "Implement the requested change" --cwd "/path/to/repo" --json
```

3. Capture the returned `task_id` if you need to inspect the underlying runtime later through low-level tooling.

## Trigger Guidance

Use this skill when:

- the task may require multiple attempts
- you need failure memory or loop-aware control
- you want a stable control layer above Claude execution with a single goal-first entrypoint

Do not use this skill for:

- one-shot trivial questions
- direct chat-only brainstorming
- tasks where control is irrelevant

## References

- For exact CLI forms, read `references/cli.md`.
- Use `scripts/anchor-control.mjs` instead of reconstructing low-level runtime commands manually.

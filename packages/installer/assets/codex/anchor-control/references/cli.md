# Anchor Control CLI

Use the Anchor CLI through `scripts/anchor-control.mjs`. The PowerShell script is a Windows fallback.

## When To Use

- Long-running coding tasks that may need multiple rounds
- Tasks that should support resume/replay/inspect
- Situations where direct backend output should not decide success
- Any workflow where you need task ledger, best-known-state, or failure memory

## Default Workflow

1. Run `doctor` first to confirm local backends are visible.
2. Start a task with `goal`.
3. Save the returned `task_id`.

## Commands

### Doctor

```bash
node ./scripts/anchor-control.mjs doctor --json
```

### Goal

```bash
node ./scripts/anchor-control.mjs goal --backend codex --goal "Implement or analyze X" --cwd "/path/to/repo" --json
```

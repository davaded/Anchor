# Anchor Control CLI

Use the repository-local `anchor` CLI through `scripts/anchor-control.ps1`.

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

```powershell
.\scripts\anchor-control.ps1 doctor -Json
```

### Goal

```powershell
.\scripts\anchor-control.ps1 goal -Backend codex -Goal "Implement or analyze X" -Cwd "D:\path\repo" -Json
```

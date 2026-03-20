# Anchor Control CLI

Use the repository-local `anchor` CLI through `scripts/anchor-control.ps1`.

## When To Use

- Long-running coding tasks that should not depend on one-shot Claude output
- Tasks that may require resume, replay, or inspect
- Situations where failure memory and best-known-state matter
- Any workflow where direct self-reported success is not sufficient

## Commands

### Doctor

```powershell
.\scripts\anchor-control.ps1 doctor -Json
```

### Goal

```powershell
.\scripts\anchor-control.ps1 goal -Backend claude -Goal "Implement or analyze X" -Cwd "D:\path\repo" -Json
```

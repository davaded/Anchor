# Anchor Control CLI

Use the Anchor CLI through `scripts/anchor-control.mjs`. The PowerShell script is a Windows fallback.

If the skill was installed from an Anchor source checkout, the installer writes `anchor-runtime.json` so the wrappers can find that workspace automatically. Otherwise set `ANCHOR_REPO_ROOT` or make an `anchor` CLI available on `PATH`.

## When To Use

- Long-running coding tasks that may need multiple rounds
- Tasks that should support resume/replay/inspect
- Situations where direct backend output should not decide success
- Any workflow where you need task ledger, best-known-state, or failure memory

## Default Workflow

1. Run `doctor` first to confirm local backends are visible.
2. Start a task with `goal`.
3. Run `test` when you want a verification report for the current work.
4. Save the returned `task_id` from goal mode if you need inspect/replay later.

## Commands

### Doctor

```bash
node ./scripts/anchor-control.mjs doctor --json
```

### Goal

```bash
node ./scripts/anchor-control.mjs goal "Implement or analyze X" --json
```

### Test

```bash
node ./scripts/anchor-control.mjs test "current work" --json
```

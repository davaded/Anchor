# Anchor Control CLI

Use the Anchor CLI through `scripts/anchor-control.mjs`. The PowerShell script is a Windows fallback.

If the skill was installed from an Anchor source checkout, the installer writes `anchor-runtime.json` so the wrappers can find that workspace automatically. Otherwise set `ANCHOR_REPO_ROOT` or make an `anchor` CLI available on `PATH`.

## When To Use

- Long-running coding tasks that should not depend on one-shot Claude output
- Tasks that may require resume, replay, or inspect
- Situations where failure memory and best-known-state matter
- Any workflow where direct self-reported success is not sufficient

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

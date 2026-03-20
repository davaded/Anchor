# Anchor Control CLI

Use the Anchor CLI through `scripts/anchor-control.mjs`. The PowerShell script is a Windows fallback.

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
node ./scripts/anchor-control.mjs goal --backend claude --goal "Implement or analyze X" --cwd "/path/to/repo" --json
```

# Anchor Runtime Workspace

Anchor is a headless control runtime for coding agents.

This workspace contains the first engineering cut of the runtime:

- `packages/core`: canonical schema, runtime, evaluator, strategy logic
- `packages/storage-sqlite`: append-only event store and projection store
- `packages/artifact-store-local`: local filesystem artifact handling
- `packages/adapter-codex`: Codex CLI subprocess adapter
- `packages/adapter-claude`: Claude Code CLI subprocess adapter
- `packages/cli`: thin command line wrapper
- `packages/workflow`: high-level workflow facade (`goal`)
- `packages/installer`: local installer for skills and Claude commands

Skill entrypoints are provided under:

- `integrations/codex/skills/anchor-control`
- `integrations/claude/skills/anchor-control`

Each skill wraps the local `anchor` CLI through `scripts/anchor-control.ps1`.

Design documents remain under `Anchor/`.

## Quick Start

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm anchor:doctor -- --json
pnpm anchor --help
pnpm anchor-workflow install
npx anchor-workflow install
```

Example skill wrapper usage:

```powershell
.\integrations\codex\skills\anchor-control\scripts\anchor-control.ps1 doctor -Json
.\integrations\codex\skills\anchor-control\scripts\anchor-control.ps1 goal -Backend codex -Goal "Implement X" -Cwd "D:\repo" -Json
```

Example workflow CLI usage:

```bash
pnpm anchor goal --backend codex --goal "Plan and implement the auth migration" --cwd D:\repo --json
```

Installer output targets:

- Codex skills: `~/.codex/skills/anchor-control`
- Claude skills: `~/.claude/skills/anchor-control`
- Claude commands: `~/.claude/commands/anchor/*`

## Storage

By default the CLI writes runtime data under `.anchor/`:

- SQLite database: `.anchor/anchor.db`
- Artifacts: `.anchor/artifacts/`

Artifacts are for transcript and log inspection only.
Control decisions come from the event log and projections.

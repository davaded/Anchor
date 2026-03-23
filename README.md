# Anchor

[English](./README.md) | [简体中文](./README.zh-CN.md)

Goal-first execution. Verification before trust.

Anchor is a skill-first control layer for Codex and Claude Code. It runs deterministic goal and verification flows, records what happened, and stops for explicit reasons instead of vague agent exits.

## Start In One Step

```bash
npx anchor-workflow install
```

That installs Anchor into:

- Codex: `~/.codex/skills/anchor-control`
- Claude Code: `~/.claude/skills/anchor-control`
- Claude commands: `~/.claude/commands/anchor/goal.md`, `~/.claude/commands/anchor/test.md`

## Core Actions

Anchor is built around two user-facing commands:

```bash
anchor goal
anchor test
```

Example:

```bash
pnpm anchor goal "Implement the auth migration" --backend codex --cwd D:\repo --json
pnpm anchor test "current work" --cwd D:\repo --json
```

If you are calling the installed skill assets directly, use the cross-platform wrapper. Installs performed from an Anchor source checkout, or with `--repo-root`, record the runtime workspace automatically. Otherwise set `ANCHOR_REPO_ROOT` or make `anchor` available on `PATH`.

```bash
node ./scripts/anchor-control.mjs doctor --json
node ./scripts/anchor-control.mjs goal "Implement the auth migration" --json
node ./scripts/anchor-control.mjs test "current work" --json
```

## Why Use Anchor

Most coding agents are good at trying things. They are much worse at:

- recognizing repeated failure patterns
- carrying structured memory across attempts
- separating backend self-report from trusted execution evidence
- leaving behind a durable execution record you can inspect later

Anchor handles that control layer.

## What You Get

- paired goal and verification entrypoints
- the same skill control model above Codex and Claude Code
- append-only task history in SQLite
- local artifacts for transcripts, patches, and command logs
- explicit terminal reasons and replayable state

## How It Works

```mermaid
flowchart LR
  U["User Request"] --> W["anchor goal / anchor test"]
  W --> R["Anchor Control Layer"]
  R --> S["SQLite Event Log"]
  R --> A["Local Artifact Store"]
  R --> C["Codex Adapter"]
  R --> L["Claude Adapter"]
```

At a high level, Anchor:

1. turns a user request into a controlled goal or verification flow
2. evaluates backend output and trusted verification evidence with explicit rules
3. records state for replay, inspection, and failure analysis

## Local State

By default, Anchor writes under `.anchor/`:

- SQLite database: `.anchor/anchor.db`
- artifacts: `.anchor/artifacts/`

Artifacts are for traceability and inspection. Control decisions come from the event log and projections.

## Build From Source

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm anchor:doctor -- --json
pnpm anchor --help
pnpm anchor-workflow install
```

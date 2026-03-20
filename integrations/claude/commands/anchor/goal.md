---
description: "Anchor goal command"
---

Use `$anchor-control` and run the main Anchor goal workflow for:

$ARGUMENTS

Requirements:
- Prefer backend `claude` unless the user explicitly wants `codex`
- Use the current workspace as `cwd`
- Treat the request as one goal-oriented workflow, not separate plan/execute/review/debug modes
- Return the resulting `task_id` and summary

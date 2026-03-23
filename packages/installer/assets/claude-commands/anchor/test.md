---
description: "Anchor test command"
---

Use `$anchor-control` and run the main Anchor verification workflow for:

$ARGUMENTS

Requirements:
- Use the current workspace implicitly; do not force the user to supply `cwd`
- Treat the request as a verification and diagnosis pass, not an implementation request
- Report issues, evidence, and repair options before any code modification
- Return the verification summary and issue list

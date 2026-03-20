# anchor-workflow

Install Anchor goal workflow assets for Codex and Claude Code.

## Usage

```bash
npx anchor-workflow install
```

When you run the installer from an Anchor source checkout, it records that workspace in the installed skills so the wrappers can execute `pnpm anchor` from the right repo automatically.

Optional flags:

- `--codex-only`
- `--claude-only`
- `--codex-dir <dir>`
- `--claude-skills-dir <dir>`
- `--claude-commands-dir <dir>`

When developing from the monorepo, you can override the linked runtime workspace with:

```bash
npx anchor-workflow install --repo-root <path-to-repo>
```

If you use the installed wrappers outside a linked workspace, set `ANCHOR_REPO_ROOT` or make an `anchor` CLI available on `PATH`.

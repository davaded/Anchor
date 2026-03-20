# anchor-workflow

Install Anchor goal workflow assets for Codex and Claude Code.

## Usage

```bash
npx anchor-workflow install
```

Optional flags:

- `--codex-only`
- `--claude-only`
- `--codex-dir <dir>`
- `--claude-skills-dir <dir>`
- `--claude-commands-dir <dir>`

When developing from the monorepo, you can override the source assets with:

```bash
npx anchor-workflow install --repo-root <path-to-repo>
```

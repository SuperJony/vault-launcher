# Agent Guide

Obsidian Vault Launcher is a macOS-only Obsidian desktop plugin that launches a vault (and optionally the active file) in external editors.

## Essentials For Every Task
- Package manager: Bun (`bun install`, `bun run <script>`).
- Build + typecheck command: `bun run build` (runs `tsc -noEmit -skipLibCheck` and a production `esbuild` bundle).
- `main.js` is generated output; do not edit it by hand.
- Keep launch execution path-safe: no `spawnSync`, no `shell: true`, and pass file paths as separate args.
- Use `gh` for GitHub operations (issues, PRs, releases, checks).

## Progressive Disclosure
- [Project structure](docs/agents/project-structure.md)
- [Development commands](docs/agents/commands.md)
- [Coding conventions](docs/agents/coding-style.md)
- [Testing guidelines](docs/agents/testing.md)
- [Platform and launch constraints](docs/agents/platform-launch.md)
- [Git and PR workflow](docs/agents/github-workflow.md)
- [Release and publishing](docs/agents/release-publishing.md)

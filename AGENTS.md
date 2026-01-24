# Repository Guidelines

## Project Structure & Module Organization
- `src/main.ts` is the Obsidian plugin entry and registers UI/actions.
- `src/ide-launch.ts` holds pure launch-planning/execution helpers; keep logic testable.
- `tests/ide-launch.test.ts` is the Bun-run TypeScript test script.
- `manifest.json` defines plugin metadata; it must align with the plugin folder name.
- `esbuild.config.mjs` bundles `src/main.ts` into `main.js`.
- `main.js` is generated output; do not edit by hand.

## Build, Test, and Development Commands
Use Bun for all scripts:
- `bun install` installs dependencies.
- `bun run dev` starts the esbuild watch build (script invokes Node internally).
- `bun run build` runs type-checks and a production bundle.
- `bun run test` executes `tests/ide-launch.test.ts`.
- `bun run test:integration` runs integration tests (requires env vars).
- `bun run lint` / `bun run format` run Biome checks and formatting.

## Coding Style & Naming Conventions
- TypeScript, ESM (`type: module`).
- Biome formatting: 2-space indent, 100-char line width, double quotes.
- Avoid `any`; keep types explicit (strict TS config).
- Filenames: kebab-case for multiword modules (e.g., `ide-launch.ts`).
- Keep launch logic side-effect free where possible; prefer pure helpers.

## Testing Guidelines
- Tests live in `tests/` and are plain TypeScript scripts run by Bun (no runner).
- Name new tests `*.test.ts` and keep cases near the feature module.
- Cover launch plan mapping, fallback behavior, and path edge cases (spaces/special chars).
- Integration tests live in `tests/ide-launch.integration.test.ts` and require:
  - `INTEGRATION=1`
  - `INTEGRATION_VAULT_PATH`
  - `INTEGRATION_FILE_PATH`

## Commit & Pull Request Guidelines
- No git history yet; use Conventional Commits (e.g., `feat: add launch plan`).
- Keep commits atomic: one logical change per commit; avoid bundling unrelated edits.
- PRs should include a short description, linked issue, test results, and screenshots for UI changes.

## Platform & Launch Notes
- Plugin targets desktop only; launch commands are macOS-focused (CLI or `open -a`).
- Do not use `spawnSync` or `shell: true`; pass paths as separate args to preserve spaces.

## Publishing to Community Plugins

### Release Workflow
1. Bump version: `bun version patch|minor|major`
   - Updates `package.json`, `manifest.json`, `versions.json` automatically
   - Creates a commit and tag (e.g., `v1.0.1`)
2. Push: `git push && git push --tags`
3. GitHub Actions builds and creates a draft release
4. Publish the draft: `gh release edit <tag> --draft=false`

### Community Plugin Submission
1. Fork [obsidian-releases](https://github.com/obsidianmd/obsidian-releases)
2. Edit `community-plugins.json`, add entry at the end
3. Create PR with title: `Add plugin: Vault Launcher`
4. Use the official PR template (required for bot validation)

### Important Notes
- Tag must NOT have `v` prefix for Obsidian bot validation; however `bun version` creates `v`-prefixed tags. The release workflow strips the `v` prefix when validating against `manifest.json`.
- Ensure `bun run build` and `bun run lint` pass before releasing.
- See `doc/PUBLISHING.md` for detailed submission requirements.


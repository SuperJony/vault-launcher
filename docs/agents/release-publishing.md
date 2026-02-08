# Release And Publishing

## Release Workflow

1. Bump version: `bun run bump patch|minor|major`.
2. Push commits and tags: `git push && git push --tags`.
3. GitHub Actions builds and creates a draft release.
4. Publish draft: `gh release edit <tag> --draft=false`.

## Important Notes

- Tags use numeric versions only (no `v` prefix), configured via `.npmrc`.
- Ensure `bun run build` and `bun run lint` pass before releasing.

## Community Submission

- First-time submission PR reference: <https://github.com/obsidianmd/obsidian-releases/pull/9761>
- Detailed publishing rules and submission requirements: `doc/PUBLISHING.md`

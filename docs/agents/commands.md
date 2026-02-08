# Development Commands

Use Bun for all project scripts.

- `bun install`: Install dependencies.
- `bun run dev`: Start esbuild watch mode (script invokes Node internally).
- `bun run build`: Run typecheck and production bundle build.
- `bun run test`: Run `tests/ide-launch.test.ts`.
- `bun run test:integration`: Run integration tests (requires environment variables in `testing.md`).
- `bun run lint`: Run Biome checks.
- `bun run format`: Run Biome formatter.
- `bun run bump patch|minor|major`: Bump version across project files and create commit/tag.

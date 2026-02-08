# Testing Guidelines

- Tests are plain TypeScript scripts in `tests/` and run with Bun (no dedicated test runner).
- Name new test files `*.test.ts`.
- Keep tests close to the feature area when feasible.
- Minimum coverage focus:
  - launch plan mapping
  - fallback behavior (CLI vs `open -a`)
  - path edge cases (spaces and special characters)

## Integration Tests

- File: `tests/ide-launch.integration.test.ts`.
- Command: `bun run test:integration`.
- Required environment variables:
  - `INTEGRATION=1`
  - `INTEGRATION_VAULT_PATH`
  - `INTEGRATION_FILE_PATH`

# Project Structure

- `src/main.ts` is the plugin entrypoint and registers UI/actions/settings.
- `src/ide-launch.ts` contains launch planning/execution helpers; keep this logic testable and as pure as possible.
- `tests/ide-launch.test.ts` is the Bun-run unit test script.
- `tests/ide-launch.integration.test.ts` contains integration tests that launch real applications.
- `manifest.json` defines plugin metadata and must stay aligned with the plugin folder name.
- `esbuild.config.mjs` bundles `src/main.ts` into `main.js`.
- `main.js` is generated output and must not be edited directly.

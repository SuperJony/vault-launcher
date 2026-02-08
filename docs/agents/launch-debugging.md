# Launch Debugging Playbook

- Debug from persisted app state first, not from visual/manual UI checks.
- Treat UI as secondary confirmation only.
- This catches workspace-shape regressions that UI checks can miss.

## Zed State DB (macOS)

- DB path: `~/Library/Application Support/Zed/db/0-stable/db.sqlite`.
- Workspace roots source: `workspaces.paths`.
- Opened file source: `editors.buffer_path`.
- `workspaces.paths` tells whether Zed persisted `vault` only or `vault + file`.
- `editors.buffer_path` confirms the target file actually opened.

## VS Code-Family State (macOS)

- Workspace metadata: `~/Library/Application Support/<App>/User/workspaceStorage/*/workspace.json`.
- Workspace state DB: `~/Library/Application Support/<App>/User/workspaceStorage/*/state.vscdb`.
- Global state DB: `~/Library/Application Support/<App>/User/globalStorage/state.vscdb`.
- Global recent key: `history.recentlyOpenedPathsList`.
- `<App>` includes `Code`, `Cursor`, and `Antigravity`.

## Zed Argument Order Rule

- For app-open with vault + file, pass `vault` before `file`.
- Applies to both `open -a "Zed"` and `open -b dev.zed.Zed`.
- Why: `file -> vault` can persist roots as `vault + file`; `vault -> file` keeps roots as `vault` while still opening the file.

## Verification Procedure (Read-Only)

1. Trigger one launch that includes vault + file.
2. Wait 2-5 seconds before reading state.
3. Read Zed state:

```bash
sqlite3 -readonly "$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite" \
  "SELECT workspace_id, replace(paths, char(10), ' | ') FROM workspaces ORDER BY workspace_id DESC LIMIT 10;"

sqlite3 -readonly "$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite" \
  "SELECT workspace_id, buffer_path FROM editors WHERE buffer_path IS NOT NULL ORDER BY workspace_id DESC LIMIT 10;"
```

4. Read VS Code-family state (example for `Code`; swap app name as needed):

```bash
ls "$HOME/Library/Application Support/Code/User/workspaceStorage"/*/workspace.json | tail -n 3

sqlite3 -readonly "$HOME/Library/Application Support/Code/User/globalStorage/state.vscdb" \
  "SELECT key FROM ItemTable WHERE key='history.recentlyOpenedPathsList';"
```

- VS Code-family state is persisted asynchronously. If results look stale, wait a few seconds and query again.

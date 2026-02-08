# Obsidian Vault Launcher

> Open your Obsidian vault in VS Code, Cursor, Antigravity, or Zed with a single click

A macOS desktop plugin for Obsidian that adds a ribbon button to launch your vault (and optionally the active file) in your preferred code editor.

## Highlights

- **One-click launch** from the ribbon
- **Open current file** option to jump directly to the active note
- **Unified fallback** app-open attempts use `open -a` first, then `open -b`
- **Path-safe** handling for spaces and special characters
- **Zero shell execution** for security and reliability

## Supported Editors

| Editor | Launch Order |
|--------|--------------|
| Visual Studio Code | `code` CLI -> `open -a "Visual Studio Code"` -> `open -b com.microsoft.VSCode` |
| Cursor | `open -a "Cursor"` -> `open -b com.todesktop.230313mzl4w4u92` |
| Antigravity | `agy` CLI -> `open -a "Antigravity"` -> `open -b com.google.antigravity` |
| Zed | `open -a "Zed"` -> `open -b dev.zed.Zed` |

CLI editors (VS Code, Antigravity) try CLI first, then app-open fallback (`open -a`, then `open -b`).

## Installation

### Community Plugins (Recommended)

1. Open **Settings > Community plugins** in Obsidian
2. Search for **Vault Launcher**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `vault-launcher.zip` from the [latest release](https://github.com/SuperJony/vault-launcher/releases/latest)
2. Extract to `<vault>/.obsidian/plugins/`
3. Enable the plugin in **Settings > Community plugins**

## Usage

1. Click the rocket icon in the ribbon
2. Select **Quick launch editor** in settings to change default editor
3. Toggle **Open current file** to include active note
4. Enable editors in **Show in command palette** to add commands

## Configuration

Settings are persisted via Obsidian's `loadData()` / `saveData()`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `editorType` | `vscode` \| `cursor` \| `antigravity` \| `zed` | `vscode` | Default editor for ribbon icon |
| `openCurrentFile` | `boolean` | `false` | Include active file in launch |
| `enabledEditors` | `Record<EditorType, boolean>` | all `false` | Editors to show in command palette |

---

## Development

### Prerequisites

- macOS
- [Bun](https://bun.sh) runtime
- Obsidian 1.7.2+

### Setup

```bash
# Clone to plugin directory
git clone https://github.com/SuperJony/vault-launcher \
  <vault>/.obsidian/plugins/vault-launcher

# Install dependencies
bun install

# Build
bun run build
```

### Watch Mode

```bash
bun run dev
```

### Build

```bash
bun run build  # includes type checking
```

### Test

Unit tests:

```bash
bun run test
```

Integration tests (launches real applications):

```bash
INTEGRATION=1 \
  INTEGRATION_VAULT_PATH=/path/to/vault \
  INTEGRATION_FILE_PATH=/path/to/vault/note.md \
  bun run test:integration
```

### Lint & Format

```bash
bun run lint
bun run format
```

### Release

```bash
bun run bump patch  # or minor/major, updates package.json + manifest.json + versions.json
git push && git push --tags
```

GitHub Actions will:
1. Build the plugin
2. Verify tag matches `manifest.json` version
3. Create a draft release with `vault-launcher.zip`, `main.js`, and `manifest.json`

Then publish the draft release on GitHub.

## Technical Notes

- Requires Obsidian 1.7.2+ (for `removeCommand` API)
- macOS desktop only
- Uses `spawn` with `shell: false` for secure path handling
- Paths passed as separate arguments to preserve spaces and special characters
- 10-second timeout per launch attempt
- App-open fallback order is `open -a`, then `open -b`; CLI editors try CLI first
- CLI failure triggers fallback; timeout does not

## Acknowledgments

Inspired by [open-obsidian-to-ide](https://github.com/maoxiaoke/open-obsidian-to-ide) by [@maoxiaoke](https://github.com/maoxiaoke).

## License

MIT

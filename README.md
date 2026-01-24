# Obsidian Vault Launcher

> Open your Obsidian vault in VS Code, Cursor, or Antigravity with a single click

A macOS desktop plugin for Obsidian that adds a ribbon button to launch your vault (and optionally the active file) in your preferred code editor.

## Highlights

- **One-click launch** from the ribbon
- **Open current file** option to jump directly to the active note
- **Smart fallback** from CLI to `open -a` when CLI is unavailable
- **Path-safe** handling for spaces and special characters
- **Zero shell execution** for security and reliability

## Supported Editors

| Editor | Primary Launch | Fallback |
|--------|---------------|----------|
| Visual Studio Code | `code` CLI | `open -a "Visual Studio Code"` |
| Cursor | `open -a "Cursor"` | - |
| Antigravity | `agy` CLI | `open -a "Antigravity"` |

Cursor uses `open -a` exclusively to avoid CLI argument parsing issues.

## Installation

1. Open **Settings > Community plugins** in Obsidian
2. Search for **Vault Launcher**
3. Click **Install**, then **Enable**

## Usage

1. Click the rocket icon in the ribbon
2. Select your default editor in **Settings > Obsidian Vault Launcher**
3. Toggle **Open current file** to include the active note
4. Enable editors in the **Enabled editors** section to add them to the command palette

## Configuration

Settings are persisted via Obsidian's `loadData()` / `saveData()`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `editorType` | `vscode` \| `cursor` \| `antigravity` | `vscode` | Default editor for ribbon icon |
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
git clone https://github.com/user/obsidian-vault-launcher \
  <vault>/.obsidian/plugins/obsidian-vault-launcher

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

## Technical Notes

- Requires Obsidian 1.7.2+ (for `removeCommand` API)
- macOS desktop only
- Uses `spawn` with `shell: false` for secure path handling
- Paths passed as separate arguments to preserve spaces and special characters
- 10-second timeout per launch attempt
- CLI failure triggers fallback; timeout does not

## Acknowledgments

Inspired by [open-obsidian-to-ide](https://github.com/maoxiaoke/open-obsidian-to-ide) by [@maoxiaoke](https://github.com/maoxiaoke).

## License

MIT

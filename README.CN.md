# Obsidian Vault Launcher

> 一键在 VS Code、Cursor 或 Antigravity 中打开 Obsidian vault

macOS 专用 Obsidian 桌面插件，通过 ribbon 按钮快速在代码编辑器中打开 vault（可选当前文件）。

## 亮点

- **一键启动** ribbon 按钮直接打开
- **打开当前文件** 可选跳转到当前笔记
- **智能回退** CLI 不可用时自动切换到 `open -a`
- **路径安全** 正确处理空格和特殊字符
- **无 shell 执行** 安全可靠

## 支持的编辑器

| 编辑器 | 主要方式 | 回退方式 |
|--------|---------|---------|
| Visual Studio Code | `code` CLI | `open -a "Visual Studio Code"` |
| Cursor | `open -a "Cursor"` | - |
| Antigravity | `agy` CLI | `open -a "Antigravity"` |

Cursor 仅使用 `open -a` 以避免 CLI 参数解析问题。

## 安装

### 社区插件（推荐）

1. 在 Obsidian 中打开 **设置 > 第三方插件**
2. 搜索 **Vault Launcher**
3. 点击 **安装**，然后 **启用**

### 手动安装

1. 从 [最新 Release](https://github.com/SuperJony/vault-launcher/releases/latest) 下载 `vault-launcher.zip`
2. 解压到 `<vault>/.obsidian/plugins/`
3. 在 **设置 > 第三方插件** 中启用

## 使用方式

1. 点击 ribbon 中的火箭图标
2. 在设置中选择 **Quick launch editor** 更改默认编辑器
3. 开启 **Open current file** 以包含当前笔记
4. 在 **Show in command palette** 中启用编辑器以添加命令

## 配置

设置通过 Obsidian `loadData()` / `saveData()` 持久化：

| 设置项 | 类型 | 默认值 | 说明 |
|-------|------|-------|------|
| `editorType` | `vscode` \| `cursor` \| `antigravity` | `vscode` | ribbon 图标默认编辑器 |
| `openCurrentFile` | `boolean` | `false` | 是否打开当前文件 |
| `enabledEditors` | `Record<EditorType, boolean>` | 全 `false` | 在命令面板中显示的编辑器 |

---

## 开发

### 前置条件

- macOS
- [Bun](https://bun.sh) 运行时
- Obsidian 1.7.2+

### 环境搭建

```bash
# 克隆到插件目录
git clone https://github.com/SuperJony/vault-launcher \
  <vault>/.obsidian/plugins/vault-launcher

# 安装依赖
bun install

# 构建
bun run build
```

### Watch 模式

```bash
bun run dev
```

### 构建

```bash
bun run build  # 含类型检查
```

### 测试

单元测试：

```bash
bun run test
```

集成测试（会启动真实应用）：

```bash
INTEGRATION=1 \
  INTEGRATION_VAULT_PATH=/path/to/vault \
  INTEGRATION_FILE_PATH=/path/to/vault/note.md \
  bun run test:integration
```

### 代码检查与格式化

```bash
bun run lint
bun run format
```

### 发布

```bash
bun run bump patch  # 或 minor/major，自动更新 package.json + manifest.json + versions.json
git push && git push --tags
```

GitHub Actions 会：
1. 构建插件
2. 验证 tag 与 `manifest.json` 版本一致
3. 创建包含 `vault-launcher.zip`、`main.js` 和 `manifest.json` 的草稿 Release

然后在 GitHub 上发布草稿。

## 技术说明

- 需要 Obsidian 1.7.2+（`removeCommand` API）
- 仅支持 macOS 桌面版
- 使用 `spawn` 且 `shell: false` 确保路径安全
- 路径作为独立参数传递，正确处理空格和特殊字符
- 每次启动 10 秒超时
- CLI 失败触发回退；超时不触发

## 致谢

灵感来自 [@maoxiaoke](https://github.com/maoxiaoke) 的 [open-obsidian-to-ide](https://github.com/maoxiaoke/open-obsidian-to-ide)。

## 许可

MIT

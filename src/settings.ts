import { type App, PluginSettingTab, Setting, SettingGroup } from "obsidian";
import { EDITOR_CONFIG, type EditorType } from "./ide-launch";
import type ObsidianVaultLauncher from "./main";

const EDITOR_OPTIONS: Record<EditorType, string> = {
  vscode: EDITOR_CONFIG.vscode.label,
  cursor: EDITOR_CONFIG.cursor.label,
  antigravity: EDITOR_CONFIG.antigravity.label,
};

function isEditorType(value: unknown): value is EditorType {
  return value === "vscode" || value === "cursor" || value === "antigravity";
}

export class VaultLauncherSettingTab extends PluginSettingTab {
  plugin: ObsidianVaultLauncher;

  constructor(app: App, plugin: ObsidianVaultLauncher) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Page title
    containerEl.createEl("h2", { text: "Vault Launcher" });

    // 1. Quick launch editor
    new Setting(containerEl)
      .setName("Quick launch editor")
      .setDesc("Editor to open when clicking the toolbar icon.")
      .addDropdown((dropdown) => {
        dropdown.addOptions(EDITOR_OPTIONS);
        dropdown.setValue(this.plugin.settings.editorType);
        dropdown.onChange(async (value) => {
          if (!isEditorType(value)) {
            console.error("Unsupported editor type from settings UI.", value);
            return;
          }
          this.plugin.settings.editorType = value;
          await this.plugin.saveSettings();
        });
      });

    // 2. Open current file
    new Setting(containerEl)
      .setName("Open current file")
      .setDesc("When enabled, also open the active file in the editor.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.openCurrentFile);
        toggle.onChange(async (value) => {
          this.plugin.settings.openCurrentFile = value;
          await this.plugin.saveSettings();
        });
      });

    // 3. Show in command palette (using SettingGroup for divider style)
    const commandPaletteGroup = new SettingGroup(containerEl).setHeading("Show in command palette");

    for (const editorKey of Object.keys(EDITOR_CONFIG) as EditorType[]) {
      const config = EDITOR_CONFIG[editorKey];
      commandPaletteGroup.addSetting((setting: Setting) => {
        setting.setName(config.label).addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.enabledEditors[editorKey]);
          toggle.onChange(async (value) => {
            this.plugin.settings.enabledEditors[editorKey] = value;
            await this.plugin.saveSettings();
            this.plugin.syncCommands();
          });
        });
      });
    }
  }
}

import { spawn } from "node:child_process";
import { join } from "node:path";
import { FileSystemAdapter, Notice, Plugin } from "obsidian";
import {
  buildLaunchPlan,
  computeCommandSyncActions,
  EDITOR_CONFIG,
  type EditorType,
  getEditorLabel,
  runLaunchPlan,
} from "./ide-launch";
import { VaultLauncherSettingTab } from "./settings";

interface ObsidianVaultLauncherSettings {
  editorType: EditorType;
  openCurrentFile: boolean;
  enabledEditors: Record<EditorType, boolean>;
}

const DEFAULT_SETTINGS: ObsidianVaultLauncherSettings = {
  editorType: "vscode",
  openCurrentFile: false,
  enabledEditors: { vscode: false, cursor: false, antigravity: false },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEditorType(value: unknown): value is EditorType {
  return value === "vscode" || value === "cursor" || value === "antigravity";
}

export default class ObsidianVaultLauncher extends Plugin {
  settings: ObsidianVaultLauncherSettings = DEFAULT_SETTINGS;
  isLaunching = false;
  registeredCommands = new Set<EditorType>();

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VaultLauncherSettingTab(this.app, this));
    this.addRibbonIcon("lucide-rocket", "Open in IDE", () => {
      void this.handleLaunch();
    });
    this.syncCommands();
  }

  async loadSettings() {
    const loaded = await this.loadData();
    const data = isRecord(loaded) ? loaded : {};

    const enabledEditors = { ...DEFAULT_SETTINGS.enabledEditors };
    if (isRecord(data.enabledEditors)) {
      for (const key of Object.keys(enabledEditors) as EditorType[]) {
        if (typeof data.enabledEditors[key] === "boolean") {
          enabledEditors[key] = data.enabledEditors[key] as boolean;
        }
      }
    }

    this.settings = {
      editorType: isEditorType(data.editorType) ? data.editorType : DEFAULT_SETTINGS.editorType,
      openCurrentFile:
        typeof data.openCurrentFile === "boolean"
          ? data.openCurrentFile
          : DEFAULT_SETTINGS.openCurrentFile,
      enabledEditors,
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async onExternalSettingsChange(): Promise<void> {
    await this.loadSettings();
    this.syncCommands();
  }

  syncCommands(): void {
    const actions = computeCommandSyncActions(
      this.settings.enabledEditors,
      this.registeredCommands,
    );
    for (const action of actions) {
      if (action.type === "register") {
        const config = EDITOR_CONFIG[action.editorKey];
        this.addCommand({
          id: `open-in-${action.editorKey}`,
          name: `Open in ${config.label}`,
          icon: "lucide-rocket",
          callback: () => void this.handleLaunch(action.editorKey),
        });
        this.registeredCommands.add(action.editorKey);
      } else {
        this.removeCommand(`open-in-${action.editorKey}`);
        this.registeredCommands.delete(action.editorKey);
      }
    }
  }

  private async handleLaunch(editor?: EditorType): Promise<void> {
    if (this.isLaunching) {
      return;
    }

    const selectedEditor = editor ?? this.settings.editorType;
    const adapter = this.app.vault.adapter;
    const editorLabel = getEditorLabel(selectedEditor);
    const failureMessage = `Failed to open in ${editorLabel}. Check console for details.`;

    if (!(adapter instanceof FileSystemAdapter)) {
      console.error("Vault adapter is not a FileSystemAdapter.");
      new Notice(failureMessage);
      return;
    }

    this.isLaunching = true;
    try {
      const vaultPath = adapter.getBasePath();
      const activeFile = this.app.workspace.getActiveFile();
      let activeFilePath: string | null = null;

      if (activeFile) {
        try {
          const resolvedPath = adapter.getFullPath(activeFile.path);
          if (resolvedPath) {
            activeFilePath = resolvedPath;
          }
        } catch (error) {
          console.error("Failed to resolve active file path via adapter.", error);
        }

        if (!activeFilePath) {
          activeFilePath = join(vaultPath, activeFile.path);
        }
      }

      const plan = buildLaunchPlan({
        editor: selectedEditor,
        vaultPath,
        activeFilePath,
        openCurrentFile: this.settings.openCurrentFile,
      });

      new Notice(`Opening in ${editorLabel}`);

      await runLaunchPlan(plan, spawn, {
        onFailureNotice: (message) => {
          new Notice(message);
        },
      });
    } catch (error) {
      console.error("Failed to build launch plan.", error);
      new Notice(failureMessage);
    } finally {
      this.isLaunching = false;
    }
  }
}

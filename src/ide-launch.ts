import { spawn } from "node:child_process";

export type EditorType = "vscode" | "cursor" | "antigravity";

export type LaunchCommand = {
  command: string;
  args: string[];
};

export type LaunchPlan = {
  editor: EditorType;
  primary: LaunchCommand;
  fallback?: LaunchCommand;
};

export type BuildLaunchPlanOptions = {
  editor: EditorType;
  vaultPath: string;
  activeFilePath: string | null;
  openCurrentFile: boolean;
};

type EditorConfig =
  | {
      label: string;
      appName: string;
      cli: string;
      useCli: true;
    }
  | {
      label: string;
      appName: string;
      useCli: false;
    };

export const EDITOR_CONFIG: Record<EditorType, EditorConfig> = {
  vscode: {
    label: "Visual Studio Code",
    appName: "Visual Studio Code",
    cli: "code",
    useCli: true,
  },
  cursor: {
    label: "Cursor",
    appName: "Cursor",
    useCli: false,
  },
  antigravity: {
    label: "Antigravity",
    appName: "Antigravity",
    cli: "agy",
    useCli: true,
  },
};

export function getEditorLabel(editor: EditorType): string {
  return EDITOR_CONFIG[editor].label;
}

export type CommandSyncAction =
  | { type: "register"; editorKey: EditorType }
  | { type: "unregister"; editorKey: EditorType };

export function computeCommandSyncActions(
  enabledEditors: Record<EditorType, boolean>,
  registeredCommands: ReadonlySet<EditorType>,
): CommandSyncAction[] {
  const actions: CommandSyncAction[] = [];
  for (const editorKey of Object.keys(EDITOR_CONFIG) as EditorType[]) {
    const isEnabled = enabledEditors[editorKey];
    const isRegistered = registeredCommands.has(editorKey);
    if (isEnabled && !isRegistered) {
      actions.push({ type: "register", editorKey });
    } else if (!isEnabled && isRegistered) {
      actions.push({ type: "unregister", editorKey });
    }
  }
  return actions;
}

const TAIL_BYTES = 8192;
const LAUNCH_TIMEOUT_MS = 10_000;
const EXTRA_PATHS = ["/opt/homebrew/bin", "/usr/local/bin"];

type AnyBuffer = Buffer<ArrayBufferLike>;

type SpawnFailure =
  | {
      kind: "error";
      error: NodeJS.ErrnoException;
      stdout?: string;
      stderr?: string;
    }
  | {
      kind: "timeout";
      stdout?: string;
      stderr?: string;
    };

type FailureDetails = {
  reason: "error" | "exit" | "signal" | "timeout";
  code: number | null;
  signal: string | null;
  stdout?: string;
  stderr?: string;
  error?: NodeJS.ErrnoException;
};

type AttemptOutcome = { status: "success" } | { status: "failure"; failure: FailureDetails };

function isSpawnFailure(value: unknown): value is SpawnFailure {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (!("kind" in value)) {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return kind === "error" || kind === "timeout";
}

function appendTail(existing: AnyBuffer, chunk: AnyBuffer | string): AnyBuffer {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  if (existing.length === 0) {
    if (buffer.length <= TAIL_BYTES) {
      return buffer;
    }
    return buffer.subarray(buffer.length - TAIL_BYTES);
  }
  const combined = Buffer.concat([existing, buffer]);
  if (combined.length <= TAIL_BYTES) {
    return combined;
  }
  return combined.subarray(combined.length - TAIL_BYTES);
}

function bufferToString(buffer: AnyBuffer): string | undefined {
  if (buffer.length === 0) {
    return undefined;
  }
  return buffer.toString("utf8");
}

function buildSpawnEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  const home = env.HOME;
  const extraPaths = home
    ? [`${home}/.antigravity/antigravity/bin`, ...EXTRA_PATHS]
    : [...EXTRA_PATHS];

  const existingPath = env.PATH ?? "";
  const existingParts = existingPath.split(":").filter((part) => part.length > 0);
  const merged = new Set<string>();
  const ordered: string[] = [];

  for (const part of [...extraPaths, ...existingParts]) {
    if (merged.has(part)) {
      continue;
    }
    merged.add(part);
    ordered.push(part);
  }

  env.PATH = ordered.join(":");
  return env;
}

function logFailure(command: LaunchCommand, failure: FailureDetails): void {
  const errorCode = failure.error?.code;
  const message =
    failure.reason === "timeout"
      ? "Launch timed out"
      : errorCode === "ENOENT"
        ? "CLI missing from PATH"
        : "Launch failed";
  console.error(message, {
    command: command.command,
    args: command.args,
    code: failure.code,
    signal: failure.signal,
    stdout: failure.stdout,
    stderr: failure.stderr,
    error: failure.error,
  });
}

function buildCliArgs(options: BuildLaunchPlanOptions): string[] {
  if (options.openCurrentFile && options.activeFilePath) {
    return ["-g", options.activeFilePath, options.vaultPath];
  }
  return [options.vaultPath];
}

function buildOpenArgs(options: BuildLaunchPlanOptions): string[] {
  if (options.openCurrentFile && options.activeFilePath) {
    return [options.activeFilePath, options.vaultPath];
  }
  return [options.vaultPath];
}

export function buildLaunchPlan(options: BuildLaunchPlanOptions): LaunchPlan {
  const cliArgs = buildCliArgs(options);
  const openArgs = buildOpenArgs(options);
  const config = EDITOR_CONFIG[options.editor];

  if (!config.useCli) {
    return {
      editor: options.editor,
      primary: {
        command: "open",
        args: ["-a", config.appName, ...openArgs],
      },
    };
  }

  return {
    editor: options.editor,
    primary: {
      command: config.cli,
      args: cliArgs,
    },
    fallback: {
      command: "open",
      args: ["-a", config.appName, ...openArgs],
    },
  };
}

export type SpawnResult = {
  code: number | null;
  signal: string | null;
  stdout?: string;
  stderr?: string;
};

export type RunLaunchOptions = {
  timeoutMs?: number;
  onFailureNotice?: (message: string) => void;
};

export type ChildProcessLike = {
  on(event: "error", handler: (error: NodeJS.ErrnoException) => void): void;
  on(event: "close", handler: (code: number | null, signal: string | null) => void): void;
  kill(signal?: NodeJS.Signals): void;
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
};

export type SpawnLike = (
  command: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
) => ChildProcessLike;

async function runSpawn(
  command: string,
  args: string[],
  spawnImpl: SpawnLike,
  options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
): Promise<SpawnResult> {
  const hasCwd = options?.cwd !== undefined;
  const hasEnv = options?.env !== undefined;
  const spawnOptions =
    hasCwd || hasEnv
      ? {
          ...(hasCwd ? { cwd: options?.cwd } : {}),
          ...(hasEnv ? { env: options?.env } : {}),
        }
      : undefined;

  return new Promise<SpawnResult>((resolve, reject) => {
    const child = spawnImpl(command, args, spawnOptions);
    let stdoutTail: AnyBuffer = Buffer.alloc(0);
    let stderrTail: AnyBuffer = Buffer.alloc(0);
    let settled = false;

    if (child.stdout) {
      child.stdout.on("data", (data: Buffer | string) => {
        stdoutTail = appendTail(stdoutTail, data);
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (data: Buffer | string) => {
        stderrTail = appendTail(stderrTail, data);
      });
    }

    const timeoutMs = options?.timeoutMs ?? LAUNCH_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      reject({
        kind: "timeout",
        stdout: bufferToString(stdoutTail),
        stderr: bufferToString(stderrTail),
      } satisfies SpawnFailure);
    }, timeoutMs);

    const finalize = () => {
      clearTimeout(timeoutId);
    };

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      finalize();
      reject({
        kind: "error",
        error,
        stdout: bufferToString(stdoutTail),
        stderr: bufferToString(stderrTail),
      } satisfies SpawnFailure);
    });

    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      finalize();
      resolve({
        code,
        signal,
        stdout: bufferToString(stdoutTail),
        stderr: bufferToString(stderrTail),
      });
    });
  });
}

async function attemptLaunch(
  command: LaunchCommand,
  spawnImpl: SpawnLike,
  timeoutMs: number,
  env: Record<string, string>,
): Promise<AttemptOutcome> {
  try {
    const result = await runSpawn(command.command, command.args, spawnImpl, {
      timeoutMs,
      env,
    });
    if (result.code !== 0 || result.signal) {
      return {
        status: "failure",
        failure: {
          reason: result.signal ? "signal" : "exit",
          code: result.code,
          signal: result.signal,
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    }
    return { status: "success" };
  } catch (error) {
    if (isSpawnFailure(error)) {
      if (error.kind === "timeout") {
        return {
          status: "failure",
          failure: {
            reason: "timeout",
            code: null,
            signal: null,
            stdout: error.stdout,
            stderr: error.stderr,
          },
        };
      }
      return {
        status: "failure",
        failure: {
          reason: "error",
          code: null,
          signal: null,
          stdout: error.stdout,
          stderr: error.stderr,
          error: error.error,
        },
      };
    }
    return {
      status: "failure",
      failure: {
        reason: "error",
        code: null,
        signal: null,
        error: error as NodeJS.ErrnoException,
      },
    };
  }
}

export async function runLaunchPlan(
  plan: LaunchPlan,
  spawnImpl: SpawnLike = spawn,
  options?: RunLaunchOptions,
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? LAUNCH_TIMEOUT_MS;
  const env = buildSpawnEnv();
  const failureMessage = `Failed to open in ${getEditorLabel(plan.editor)}. Check console for details.`;

  const primaryResult = await attemptLaunch(plan.primary, spawnImpl, timeoutMs, env);
  if (primaryResult.status === "success") {
    return;
  }

  logFailure(plan.primary, primaryResult.failure);

  if (primaryResult.failure.reason === "timeout") {
    options?.onFailureNotice?.(failureMessage);
    return;
  }

  if (!plan.fallback) {
    options?.onFailureNotice?.(failureMessage);
    return;
  }

  const fallbackResult = await attemptLaunch(plan.fallback, spawnImpl, timeoutMs, env);
  if (fallbackResult.status === "success") {
    return;
  }

  logFailure(plan.fallback, fallbackResult.failure);
  options?.onFailureNotice?.(failureMessage);
}

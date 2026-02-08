import assert from "node:assert/strict";
import { PassThrough } from "node:stream";

async function loadModule() {
  try {
    return await import("../src/ide-launch");
  } catch (error) {
    console.error("Failed to import ../src/ide-launch. Implement the module before running tests.");
    throw error;
  }
}

const { buildLaunchPlan, runLaunchPlan, computeCommandSyncActions } = await loadModule();

assert.equal(typeof buildLaunchPlan, "function", "buildLaunchPlan must be a function");
assert.equal(typeof runLaunchPlan, "function", "runLaunchPlan must be a function");
assert.equal(
  typeof computeCommandSyncActions,
  "function",
  "computeCommandSyncActions must be a function",
);

type TestCase = { name: string; fn: () => void | Promise<void> };
const tests: TestCase[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

const vaultPath = "/Users/test/Vault With Space";
const activeFilePath = "/Users/test/Vault With Space/Notes/Note.md";
const cliArgsWithFile = ["-g", activeFilePath, vaultPath];
const cliArgsVaultOnly = [vaultPath];
const openArgsWithFile = [activeFilePath, vaultPath];
const openArgsVaultOnly = [vaultPath];
const TAIL_BYTES = 8192;
const TEST_TIMEOUT_MS = 2000;

const cliCases = [
  {
    editor: "vscode" as const,
    cli: "code",
    appName: "Visual Studio Code",
    bundleId: "com.microsoft.VSCode",
  },
  {
    editor: "antigravity" as const,
    cli: "agy",
    appName: "Antigravity",
    bundleId: "com.google.antigravity",
  },
];

const nonCliCases = [
  {
    editor: "cursor" as const,
    appName: "Cursor",
    bundleId: "com.todesktop.230313mzl4w4u92",
    withFileArgs: openArgsWithFile,
  },
  {
    editor: "zed" as const,
    appName: "Zed",
    bundleId: "dev.zed.Zed",
    withFileArgs: [vaultPath, activeFilePath],
  },
];

function appOpenArgs(appName: string, args: string[]) {
  return ["-a", appName, ...args];
}

function bundleOpenArgs(bundleId: string, args: string[]) {
  return ["-b", bundleId, ...args];
}

function openAttempts(appName: string, bundleId: string, args: string[]) {
  return [
    {
      command: "open",
      args: appOpenArgs(appName, args),
    },
    {
      command: "open",
      args: bundleOpenArgs(bundleId, args),
    },
  ];
}

for (const { editor, cli, appName, bundleId } of cliCases) {
  test(`${editor}: open current file`, () => {
    const plan = buildLaunchPlan({
      editor,
      vaultPath,
      activeFilePath,
      openCurrentFile: true,
    });

    assert.deepEqual(plan.attempts, [
      { command: cli, args: cliArgsWithFile },
      ...openAttempts(appName, bundleId, openArgsWithFile),
    ]);
  });

  test(`${editor}: vault only when openCurrentFile is false`, () => {
    const plan = buildLaunchPlan({
      editor,
      vaultPath,
      activeFilePath,
      openCurrentFile: false,
    });

    assert.deepEqual(plan.attempts, [
      { command: cli, args: cliArgsVaultOnly },
      ...openAttempts(appName, bundleId, openArgsVaultOnly),
    ]);
  });

  test(`${editor}: vault only when active file is missing`, () => {
    const plan = buildLaunchPlan({
      editor,
      vaultPath,
      activeFilePath: null,
      openCurrentFile: true,
    });

    assert.deepEqual(plan.attempts, [
      { command: cli, args: cliArgsVaultOnly },
      ...openAttempts(appName, bundleId, openArgsVaultOnly),
    ]);
  });
}

for (const { editor, appName, bundleId, withFileArgs } of nonCliCases) {
  test(`${editor}: open current file uses open -a then open -b`, () => {
    const plan = buildLaunchPlan({
      editor,
      vaultPath,
      activeFilePath,
      openCurrentFile: true,
    });

    assert.deepEqual(plan.attempts, openAttempts(appName, bundleId, withFileArgs));
  });

  test(`${editor}: vault only when openCurrentFile is false`, () => {
    const plan = buildLaunchPlan({
      editor,
      vaultPath,
      activeFilePath,
      openCurrentFile: false,
    });

    assert.deepEqual(plan.attempts, openAttempts(appName, bundleId, openArgsVaultOnly));
  });

  test(`${editor}: vault only when active file is missing`, () => {
    const plan = buildLaunchPlan({
      editor,
      vaultPath,
      activeFilePath: null,
      openCurrentFile: true,
    });

    assert.deepEqual(plan.attempts, openAttempts(appName, bundleId, openArgsVaultOnly));
  });
}

test("buildLaunchPlan: preserves special characters in paths", () => {
  const specialVault = "/Users/test/Vault #1 | Space";
  const specialFile = "/Users/test/Vault #1 | Space/Notes/Note #1 |.md";
  const plan = buildLaunchPlan({
    editor: "vscode",
    vaultPath: specialVault,
    activeFilePath: specialFile,
    openCurrentFile: true,
  });

  assert.deepEqual(plan.attempts, [
    { command: "code", args: ["-g", specialFile, specialVault] },
    {
      command: "open",
      args: ["-a", "Visual Studio Code", specialFile, specialVault],
    },
    {
      command: "open",
      args: ["-b", "com.microsoft.VSCode", specialFile, specialVault],
    },
  ]);
});

type SpawnCall = {
  command: string;
  args: string[];
};

type SpawnOptions = { cwd?: string; env?: Record<string, string> } | undefined;

type SpawnOutcome =
  | {
      type: "close";
      code: number | null;
      signal: string | null;
      stdout?: string;
      stderr?: string;
    }
  | {
      type: "hang";
      stdout?: string;
      stderr?: string;
    }
  | {
      type: "error";
      error: NodeJS.ErrnoException;
      stdout?: string;
      stderr?: string;
    };

type ChildProcessLike = {
  on(event: "error", handler: (error: NodeJS.ErrnoException) => void): void;
  on(event: "close", handler: (code: number | null, signal: string | null) => void): void;
  kill(signal?: NodeJS.Signals): void;
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
};

type SpawnLike = (
  command: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
) => ChildProcessLike;

function createSpawnMock(outcomes: SpawnOutcome[]) {
  const calls: SpawnCall[] = [];
  const kills: Array<NodeJS.Signals | undefined> = [];
  const optionsList: SpawnOptions[] = [];
  let callIndex = 0;

  const spawnImpl: SpawnLike = (command, args, options) => {
    calls.push({ command, args });
    optionsList.push(options);
    const outcome = outcomes[callIndex];
    callIndex += 1;
    const handlers: {
      error?: (error: NodeJS.ErrnoException) => void;
      close?: (code: number | null, signal: string | null) => void;
    } = {};
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    queueMicrotask(() => {
      if (!outcome) {
        stdout.end();
        stderr.end();
        handlers.close?.(0, null);
        return;
      }
      if (outcome.type === "hang") {
        if (outcome.stdout) {
          stdout.write(outcome.stdout);
        }
        if (outcome.stderr) {
          stderr.write(outcome.stderr);
        }
        stdout.end();
        stderr.end();
        return;
      }
      if (outcome.stdout) {
        stdout.write(outcome.stdout);
      }
      if (outcome.stderr) {
        stderr.write(outcome.stderr);
      }
      stdout.end();
      stderr.end();

      queueMicrotask(() => {
        if (outcome.type === "error") {
          handlers.error?.(outcome.error);
          return;
        }
        handlers.close?.(outcome.code, outcome.signal);
      });
    });

    return {
      on(event: "error" | "close", handler: ((...args: never[]) => void) | undefined) {
        if (event === "error") {
          handlers.error = handler as typeof handlers.error;
        } else {
          handlers.close = handler as typeof handlers.close;
        }
      },
      kill(signal) {
        kills.push(signal);
      },
      stdout,
      stderr,
    };
  };

  return { spawnImpl, calls, kills, optionsList };
}

test("runLaunchPlan: stops on first success", async () => {
  const plan = buildLaunchPlan({
    editor: "vscode",
    vaultPath,
    activeFilePath,
    openCurrentFile: true,
  });
  const { spawnImpl, calls } = createSpawnMock([{ type: "close", code: 0, signal: null }]);

  await runLaunchPlan(plan, spawnImpl);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], plan.attempts[0]);
});

test("runLaunchPlan: extends PATH for CLI launches", async () => {
  const originalPath = process.env.PATH;
  const originalHome = process.env.HOME;
  process.env.PATH = "/usr/bin:/bin";
  process.env.HOME = "/Users/test";

  try {
    const plan = buildLaunchPlan({
      editor: "vscode",
      vaultPath,
      activeFilePath,
      openCurrentFile: true,
    });
    const { spawnImpl, optionsList } = createSpawnMock([{ type: "close", code: 0, signal: null }]);

    await runLaunchPlan(plan, spawnImpl);

    assert.equal(optionsList.length, 1);
    const env = optionsList[0]?.env;
    assert.ok(env && typeof env.PATH === "string");
    const parts = env.PATH.split(":");
    assert.equal(parts[0], "/Users/test/.antigravity/antigravity/bin");
    assert.equal(parts[1], "/opt/homebrew/bin");
    assert.equal(parts[2], "/usr/local/bin");
    assert.ok(parts.includes("/usr/bin"));
    assert.ok(parts.includes("/bin"));
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  }
});

test("runLaunchPlan: retries next attempt on non-timeout failure", async () => {
  const plan = buildLaunchPlan({
    editor: "vscode",
    vaultPath,
    activeFilePath,
    openCurrentFile: true,
  });
  const { spawnImpl, calls } = createSpawnMock([
    { type: "close", code: 1, signal: null },
    { type: "close", code: 0, signal: null },
  ]);

  await runLaunchPlan(plan, spawnImpl);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], plan.attempts[0]);
  assert.deepEqual(calls[1], plan.attempts[1]);
});

test("runLaunchPlan: error event retries next attempt", async () => {
  const plan = buildLaunchPlan({
    editor: "antigravity",
    vaultPath,
    activeFilePath,
    openCurrentFile: true,
  });
  const { spawnImpl, calls } = createSpawnMock([
    {
      type: "error",
      error: Object.assign(new Error("missing"), { code: "ENOENT" }),
    },
    { type: "close", code: 0, signal: null },
  ]);

  await runLaunchPlan(plan, spawnImpl);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], plan.attempts[0]);
  assert.deepEqual(calls[1], plan.attempts[1]);
});

test("runLaunchPlan: signal failure retries next attempt", async () => {
  const plan = buildLaunchPlan({
    editor: "antigravity",
    vaultPath,
    activeFilePath,
    openCurrentFile: true,
  });
  const { spawnImpl, calls } = createSpawnMock([
    { type: "close", code: null, signal: "SIGTERM" },
    { type: "close", code: 0, signal: null },
  ]);

  await runLaunchPlan(plan, spawnImpl);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], plan.attempts[0]);
  assert.deepEqual(calls[1], plan.attempts[1]);
});

function collectStringsFromValue(value: unknown, results: string[], seen: Set<unknown>) {
  if (typeof value === "string") {
    results.push(value);
    return;
  }
  if (value instanceof Buffer) {
    results.push(value.toString("utf8"));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringsFromValue(item, results, seen);
    }
    return;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectStringsFromValue(item, results, seen);
  }
}

async function withConsoleErrorCapture<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; calls: unknown[][] }> {
  const original = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    const result = await fn();
    return { result, calls };
  } finally {
    console.error = original;
  }
}

async function withTestTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Test timeout after ${ms} ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function tailByBytes(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, "utf8");
  if (buffer.length <= maxBytes) {
    return value;
  }
  return buffer.subarray(buffer.length - maxBytes).toString("utf8");
}

test("runLaunchPlan: truncates stdout/stderr to 8 KB (8192 bytes) on failure logs", async () => {
  const plan = buildLaunchPlan({
    editor: "vscode",
    vaultPath,
    activeFilePath,
    openCurrentFile: true,
  });
  const longStdout = "x".repeat(10000);
  const longStderr = "y".repeat(9000);
  const { spawnImpl } = createSpawnMock([
    { type: "close", code: 1, signal: null, stdout: longStdout, stderr: longStderr },
    { type: "close", code: 0, signal: null },
  ]);

  const { calls } = await withConsoleErrorCapture(async () => {
    await runLaunchPlan(plan, spawnImpl);
  });

  const strings: string[] = [];
  const seen = new Set<unknown>();
  for (const call of calls) {
    for (const arg of call) {
      collectStringsFromValue(arg, strings, seen);
    }
  }
  const joined = strings.join(" ");
  const truncatedStdout = tailByBytes(longStdout, TAIL_BYTES);
  const truncatedStderr = tailByBytes(longStderr, TAIL_BYTES);

  assert.ok(
    joined.includes(truncatedStdout),
    "Expected truncated stdout (last 8192 bytes) to be logged",
  );
  assert.ok(
    joined.includes(truncatedStderr),
    "Expected truncated stderr (last 8192 bytes) to be logged",
  );
  assert.ok(!joined.includes(longStdout), "Expected stdout to be truncated to 8 KB");
  assert.ok(!joined.includes(longStderr), "Expected stderr to be truncated to 8 KB");
  assert.ok(joined.includes(plan.attempts[0].command), "Expected command to be logged");
  assert.ok(joined.includes(activeFilePath), "Expected args to be logged");
});

test("runLaunchPlan: timeout stops chain (no further retries)", async () => {
  const plan = buildLaunchPlan({
    editor: "vscode",
    vaultPath,
    activeFilePath,
    openCurrentFile: true,
  });
  const { spawnImpl, calls, kills } = createSpawnMock([{ type: "hang" }]);

  await withTestTimeout(runLaunchPlan(plan, spawnImpl, { timeoutMs: 5 }), 50);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], plan.attempts[0]);
  assert.equal(kills.length, 1);
  assert.equal(kills[0], "SIGTERM");
});

test("runLaunchPlan: non-CLI retry uses bundle-id attempt after app-name failure", async () => {
  const plan = buildLaunchPlan({
    editor: "cursor",
    vaultPath,
    activeFilePath,
    openCurrentFile: true,
  });
  const { spawnImpl, calls } = createSpawnMock([
    { type: "close", code: 1, signal: null },
    { type: "close", code: 0, signal: null },
  ]);

  await runLaunchPlan(plan, spawnImpl);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], plan.attempts[0]);
  assert.deepEqual(calls[1], plan.attempts[1]);
});

test("runLaunchPlan: failure notice emitted once after all attempts fail", async () => {
  const plan = buildLaunchPlan({
    editor: "antigravity",
    vaultPath,
    activeFilePath,
    openCurrentFile: true,
  });
  const { spawnImpl, calls } = createSpawnMock([
    { type: "close", code: 1, signal: null },
    { type: "close", code: 1, signal: null },
    { type: "close", code: 1, signal: null },
  ]);
  const notices: string[] = [];

  await runLaunchPlan(plan, spawnImpl, {
    onFailureNotice: (message) => {
      notices.push(message);
    },
  });

  assert.equal(calls.length, plan.attempts.length);
  assert.equal(notices.length, 1);
});

// computeCommandSyncActions tests

test("computeCommandSyncActions: enable unregistered editor -> register action", () => {
  const enabledEditors = { vscode: true, cursor: false, antigravity: false, zed: false };
  const registeredCommands = new Set<"vscode" | "cursor" | "antigravity" | "zed">();

  const actions = computeCommandSyncActions(enabledEditors, registeredCommands);

  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0], { type: "register", editorKey: "vscode" });
});

test("computeCommandSyncActions: disable registered editor -> unregister action", () => {
  const enabledEditors = { vscode: false, cursor: false, antigravity: false, zed: false };
  const registeredCommands = new Set<"vscode" | "cursor" | "antigravity" | "zed">(["vscode"]);

  const actions = computeCommandSyncActions(enabledEditors, registeredCommands);

  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0], { type: "unregister", editorKey: "vscode" });
});

test("computeCommandSyncActions: no state change -> empty actions", () => {
  const enabledEditors = { vscode: true, cursor: false, antigravity: false, zed: false };
  const registeredCommands = new Set<"vscode" | "cursor" | "antigravity" | "zed">(["vscode"]);

  const actions = computeCommandSyncActions(enabledEditors, registeredCommands);

  assert.equal(actions.length, 0);
});

test("computeCommandSyncActions: enable multiple editors -> multiple register actions", () => {
  const enabledEditors = { vscode: true, cursor: true, antigravity: true, zed: true };
  const registeredCommands = new Set<"vscode" | "cursor" | "antigravity" | "zed">();

  const actions = computeCommandSyncActions(enabledEditors, registeredCommands);

  assert.equal(actions.length, 4);
  const registerTypes = actions.filter((a) => a.type === "register").map((a) => a.editorKey);
  assert.ok(registerTypes.includes("vscode"));
  assert.ok(registerTypes.includes("cursor"));
  assert.ok(registerTypes.includes("antigravity"));
  assert.ok(registerTypes.includes("zed"));
});

test("computeCommandSyncActions: mixed states -> correct actions for each", () => {
  const enabledEditors = { vscode: true, cursor: false, antigravity: true, zed: false };
  const registeredCommands = new Set<"vscode" | "cursor" | "antigravity" | "zed">([
    "cursor",
    "antigravity",
    "zed",
  ]);

  const actions = computeCommandSyncActions(enabledEditors, registeredCommands);

  assert.equal(actions.length, 3);
  const vsAction = actions.find((a) => a.editorKey === "vscode");
  const cursorAction = actions.find((a) => a.editorKey === "cursor");
  const zedAction = actions.find((a) => a.editorKey === "zed");
  assert.deepEqual(vsAction, { type: "register", editorKey: "vscode" });
  assert.deepEqual(cursorAction, { type: "unregister", editorKey: "cursor" });
  assert.deepEqual(zedAction, { type: "unregister", editorKey: "zed" });
});

for (const { name, fn } of tests) {
  try {
    await withTestTimeout(Promise.resolve().then(fn), TEST_TIMEOUT_MS);
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

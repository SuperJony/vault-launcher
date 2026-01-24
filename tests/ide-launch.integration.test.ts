import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

async function loadModule() {
  try {
    return await import("../src/ide-launch");
  } catch (error) {
    console.error("Failed to import ../src/ide-launch. Implement the module before running tests.");
    throw error;
  }
}

const { buildLaunchPlan, runLaunchPlan } = await loadModule();

assert.equal(typeof buildLaunchPlan, "function", "buildLaunchPlan must be a function");
assert.equal(typeof runLaunchPlan, "function", "runLaunchPlan must be a function");

const TEST_TIMEOUT_MS = 20_000;

type TestCase = { name: string; fn: () => void | Promise<void> };
const tests: TestCase[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

async function loadDotEnv(): Promise<void> {
  try {
    const content = await readFile(new URL("../.env", import.meta.url), "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const equalsIndex = line.indexOf("=");
      if (equalsIndex <= 0) {
        continue;
      }
      const key = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();
      if (!key) {
        continue;
      }
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
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

await loadDotEnv();

const INTEGRATION = process.env.INTEGRATION === "1";
const INTEGRATION_VAULT_PATH = process.env.INTEGRATION_VAULT_PATH;
const INTEGRATION_FILE_PATH = process.env.INTEGRATION_FILE_PATH;

if (!INTEGRATION) {
  console.log("skip - integration disabled (set INTEGRATION=1)");
} else {
  test("integration: launches code/agy/cursor with real commands", async () => {
    if (!INTEGRATION_VAULT_PATH || !INTEGRATION_FILE_PATH) {
      throw new Error("Set INTEGRATION_VAULT_PATH and INTEGRATION_FILE_PATH when INTEGRATION=1.");
    }

    await access(INTEGRATION_VAULT_PATH);
    await access(INTEGRATION_FILE_PATH);

    const editors = ["vscode", "antigravity", "cursor"] as const;
    for (const editor of editors) {
      const plan = buildLaunchPlan({
        editor,
        vaultPath: INTEGRATION_VAULT_PATH,
        activeFilePath: INTEGRATION_FILE_PATH,
        openCurrentFile: true,
      });

      await runLaunchPlan(plan);
    }
  });

  test("integration: launches code/agy/cursor with vault only", async () => {
    if (!INTEGRATION_VAULT_PATH) {
      throw new Error("Set INTEGRATION_VAULT_PATH when INTEGRATION=1.");
    }

    await access(INTEGRATION_VAULT_PATH);

    const editors = ["vscode", "antigravity", "cursor"] as const;
    for (const editor of editors) {
      const plan = buildLaunchPlan({
        editor,
        vaultPath: INTEGRATION_VAULT_PATH,
        activeFilePath: null,
        openCurrentFile: false,
      });

      await runLaunchPlan(plan);
    }
  });
}

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

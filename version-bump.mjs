import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const bumpType = process.argv[2];
if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error("Usage: bun version-bump.mjs <patch|minor|major>");
  process.exit(1);
}

// Read current version from package.json
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

// Calculate new version
let newVersion;
if (bumpType === "major") {
  newVersion = `${major + 1}.0.0`;
} else if (bumpType === "minor") {
  newVersion = `${major}.${minor + 1}.0`;
} else {
  newVersion = `${major}.${minor}.${patch + 1}`;
}

console.log(`${pkg.version} -> ${newVersion}`);

// Update package.json
pkg.version = newVersion;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

// Update manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = newVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

// Update versions.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
if (!(newVersion in versions)) {
  versions[newVersion] = minAppVersion;
  writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
}

// Git commit and tag
execFileSync("git", ["add", "package.json", "manifest.json", "versions.json"]);
execFileSync("git", ["commit", "-m", newVersion]);
execFileSync("git", ["tag", newVersion]);

console.log(`Created commit and tag: ${newVersion}`);

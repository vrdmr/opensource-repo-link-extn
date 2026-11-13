import { execFileSync } from "node:child_process";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const versionFiles = [
  "package.json", "package-lock.json", "public/manifest.json",
  "safari/macos/manifest.json", "safari/ios/manifest.json",
];

function parseVersion(version) {
  if (typeof version !== "string" || !versionPattern.test(version)) {
    throw new Error(`Expected a stable major.minor.patch version, got ${version}.`);
  }
  const parts = version.split(".").map(Number);
  if (parts.some((part) => part > 65535)) {
    throw new Error("Browser manifest version components cannot exceed 65535.");
  }
  return parts;
}

export function nextVersion(current, tags, { minor = false, major = false } = {}) {
  if (minor && major) {
    throw new Error("Select either minor or major, not both.");
  }
  let latest = parseVersion(current);
  for (const tag of tags) {
    const version = tag.replace(/^v/, "");
    if (!versionPattern.test(version)) continue;
    const candidate = parseVersion(version);
    const index = candidate.findIndex((part, i) => part !== latest[i]);
    if (index !== -1 && candidate[index] > latest[index]) latest = candidate;
  }
  const index = major ? 0 : minor ? 1 : 2;
  latest[index]++;
  latest.fill(0, index + 1);
  const version = latest.join(".");
  parseVersion(version);
  return version;
}

export async function updateVersion(root, tags, options) {
  const documents = await Promise.all(versionFiles.map(async (path) => ({
    path: new URL(path, root),
    content: JSON.parse(await readFile(new URL(path, root), "utf8")),
  })));
  const current = documents[0].content.version;
  if (
    documents.some(({ content }) => content.version !== current) ||
    documents[1].content.packages?.[""]?.version !== current
  ) {
    throw new Error("Package, lockfile and all browser manifest versions must agree before release.");
  }
  const version = nextVersion(current, tags, options);
  for (const document of documents) document.content.version = version;
  documents[1].content.packages[""].version = version;
  for (const { path, content } of documents) {
    await writeFile(path, `${JSON.stringify(content, null, 2)}\n`);
  }
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL("../", import.meta.url);
  for (const name of ["BUMP_MINOR", "BUMP_MAJOR"]) {
    if (![undefined, "false", "true"].includes(process.env[name])) {
      throw new Error(`${name} must be true or false.`);
    }
  }
  const tags = execFileSync("git", ["tag", "--list"], { cwd: root, encoding: "utf8" })
    .trim().split("\n");
  const version = await updateVersion(root, tags, {
    minor: process.env.BUMP_MINOR === "true",
    major: process.env.BUMP_MAJOR === "true",
  });
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`);
  }
  console.log(`Selected v${version}; synchronized package, lockfile and browser manifests.`);
}

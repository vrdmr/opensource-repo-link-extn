import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { nextVersion, updateVersion } from "../scripts/release-version.mjs";
import { packageRelease } from "../scripts/package-release.mjs";

const root = new URL("../", import.meta.url);
const versionFiles = [
  "package.json", "package-lock.json", "public/manifest.json",
  "safari/macos/manifest.json", "safari/ios/manifest.json",
];

async function fixture(t, paths) {
  const directory = await mkdtemp(join(tmpdir(), "portal-link-release-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const url = pathToFileURL(`${directory}/`);
  for (const path of paths) {
    const target = new URL(path, url);
    await mkdir(new URL("./", target), { recursive: true });
    await cp(new URL(path, root), target, { recursive: true });
  }
  return url;
}

test("release defaults to patch after the highest stable project or tag version", () => {
  assert.equal(nextVersion("0.3.0", []), "0.3.1");
  assert.equal(nextVersion("0.3.0", ["v0.9.9", "v0.10.0", "0.10.2", "v0.10.1"]), "0.10.3");
  assert.equal(nextVersion("2.0.0", ["v1.9.9", "v9.0.0-beta.1", "nightly", "v01.0.0"]), "2.0.1");
});

test("minor and major checkboxes reset lower components and cannot both be selected", () => {
  assert.equal(nextVersion("0.3.9", ["v0.4.7"], { minor: true }), "0.5.0");
  assert.equal(nextVersion("0.3.9", ["v1.4.7"], { major: true }), "2.0.0");
  assert.throws(() => nextVersion("0.3.0", [], { major: true, minor: true }), /not both/);
});

test("release rejects prerelease project versions and browser version overflow", () => {
  for (const version of ["0.3.0-beta.1", "v0.3.0", "01.3.0", "1.0", "65536.0.0"]) {
    assert.throws(() => nextVersion(version, []));
  }
  assert.throws(() => nextVersion("1.2.65535", []), /65535/);
  assert.throws(() => nextVersion("65535.0.0", [], { major: true }), /65535/);
});

test("version preparation synchronizes all five source files without dependency changes", async (t) => {
  const directory = await fixture(t, versionFiles);
  const before = JSON.parse(await readFile(new URL("package-lock.json", directory), "utf8"));
  const version = await updateVersion(directory, ["v4.5.6"], { minor: true });
  assert.equal(version, nextVersion(before.version, ["v4.5.6"], { minor: true }));
  for (const file of versionFiles) {
    assert.equal(JSON.parse(await readFile(new URL(file, directory), "utf8")).version, version);
  }
  const after = JSON.parse(await readFile(new URL("package-lock.json", directory), "utf8"));
  before.version = version;
  before.packages[""].version = version;
  assert.deepEqual(after, before);
});

test("inconsistent versions and conflicting checkboxes fail before any file is rewritten", async (t) => {
  const directory = await fixture(t, versionFiles);
  const manifestPath = new URL("safari/ios/manifest.json", directory);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = "42.0.0";
  await writeFile(manifestPath, JSON.stringify(manifest));
  const before = await Promise.all(versionFiles.map((file) => readFile(new URL(file, directory), "utf8")));
  await assert.rejects(updateVersion(directory, [], {}), /must agree/);
  assert.deepEqual(await Promise.all(versionFiles.map((file) =>
    readFile(new URL(file, directory), "utf8"))), before);
  await cp(new URL("safari/ios/manifest.json", root), manifestPath);
  const currentPackage = await readFile(new URL("package.json", directory), "utf8");
  await assert.rejects(updateVersion(directory, [], { minor: true, major: true }), /not both/);
  assert.equal(await readFile(new URL("package.json", directory), "utf8"), currentPackage);
});

test("version CLI reads git tags and writes Actions outputs without creating a commit or tag", async (t) => {
  const directory = await fixture(t, [...versionFiles, "scripts/release-version.mjs"]);
  const git = (...args) => execFileSync("git", [
    "-c", "core.hooksPath=", "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args,
  ], { cwd: directory, stdio: "pipe", timeout: 10000 });
  git("init", "--quiet");
  git("add", ".");
  git("-c", "user.name=Release Test", "-c", "user.email=release@example.com",
    "commit", "--quiet", "-m", "Fixture");
  git("tag", "v4.0.9");
  const output = new URL("output.txt", directory);
  const { version: current } = JSON.parse(await readFile(new URL("package.json", directory), "utf8"));
  const expected = nextVersion(current, ["v4.0.9"]);
  execFileSync(process.execPath, ["scripts/release-version.mjs"], {
    cwd: directory,
    env: { ...process.env, BUMP_MINOR: "false", BUMP_MAJOR: "false", GITHUB_OUTPUT: fileURLToPath(output) },
    stdio: "pipe",
    timeout: 10000,
  });
  assert.equal(await readFile(output, "utf8"), `version=${expected}\ntag=v${expected}\n`);
  assert.equal(git("rev-list", "--all", "--count").toString().trim(), "1");
  assert.equal(git("tag", "--list").toString().trim(), "v4.0.9");
});

const resources = ["package.json", "dist/", "build/safari/macos/", "build/safari/ios/"];

test("release ZIPs contain root manifests, runtime-only files and verified checksums", async (t) => {
  const directory = await fixture(t, resources);
  await packageRelease(directory);
  const output = new URL("build/releases/", directory);
  const files = await readdir(output);
  assert.equal(files.length, 4);
  const { version } = JSON.parse(await readFile(new URL("package.json", directory), "utf8"));
  const checksums = await readFile(new URL("SHA256SUMS.txt", output), "utf8");
  for (const file of files.filter((name) => name.endsWith(".zip"))) {
    const archive = new URL(file, output);
    const manifest = JSON.parse(execFileSync("unzip", ["-p", fileURLToPath(archive), "manifest.json"], {
      encoding: "utf8",
    }));
    assert.equal(manifest.version, version);
    const entries = execFileSync("unzip", ["-Z1", fileURLToPath(archive)], { encoding: "utf8" });
    assert.doesNotMatch(entries, /(^|\n)(dist|build|src|tests|node_modules)\//);
    assert.doesNotMatch(entries, /\.ts($|\n)/);
    const hash = createHash("sha256").update(await readFile(archive)).digest("hex");
    assert.ok(checksums.includes(`${hash}  ${file}\n`));
  }
  await assert.rejects(packageRelease(directory), /must be empty/);
});

test("packaging rejects stale versions, unexpected files and symlinks before creating archives", async (t) => {
  const directory = await fixture(t, resources);
  const manifestPath = new URL("dist/manifest.json", directory);
  const original = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(original);
  manifest.version = "42.0.0";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(packageRelease(directory), /Stale edge build/);
  await writeFile(manifestPath, original);
  const extra = new URL("dist/.env", directory);
  await writeFile(extra, "test fixture");
  await assert.rejects(packageRelease(directory), /Unexpected edge files/);
  await rm(extra);
  await symlink(new URL("package.json", directory), new URL("dist/linked.json", directory));
  await assert.rejects(packageRelease(directory), /symlinks/);
  await assert.rejects(readdir(new URL("build/releases/", directory)), { code: "ENOENT" });
});

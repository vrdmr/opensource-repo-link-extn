import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const icons = [16, 32, 48, 128].map((size) => `icons/icon${size}.png`);
const common = ["manifest.json", "navigation.js", "repo-url.js", ...icons];
const targets = [
  { name: "edge", path: "dist/", files: [...common, "desktop-actions.js", "service-worker.js"] },
  { name: "safari-macos", path: "build/safari/macos/", files: [
    ...common, "desktop-actions.js", "safari/macos-background.js",
  ] },
  { name: "safari-ios-resources", path: "build/safari/ios/", files: [
    ...common, "popup.html", "popup.css", "safari/theme.js",
    "safari/ios-popup.js", "safari/popup-controller.js",
  ] },
];

async function filesIn(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(entry.isFile() || entry.isDirectory(), "Release resources cannot contain symlinks.");
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await filesIn(new URL(`${entry.name}/`, directory), `${path}/`));
    } else {
      files.push(path);
    }
  }
  return files.sort();
}

export async function packageRelease(root) {
  const { version } = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const output = new URL("build/releases/", root);
  for (const target of targets) {
    const directory = new URL(target.path, root);
    assert.deepEqual(await filesIn(directory), [...target.files].sort(),
      `Unexpected ${target.name} files; rebuild and review package contents.`);
    const manifest = JSON.parse(await readFile(new URL("manifest.json", directory), "utf8"));
    assert.equal(manifest.version, version, `Stale ${target.name} build; run npm test first.`);
  }
  await mkdir(output, { recursive: true });
  assert.equal((await readdir(output)).length, 0,
    "build/releases must be empty; move or remove previous release artifacts first.");
  const checksums = [];
  for (const target of targets) {
    const filename = `open-source-portal-link-${version}-${target.name}.zip`;
    const archive = new URL(filename, output);
    execFileSync("zip", ["-X", "-q", fileURLToPath(archive), ...target.files.slice().sort()], {
      cwd: new URL(target.path, root), stdio: "pipe",
    });
    execFileSync("unzip", ["-tq", fileURLToPath(archive)], { stdio: "pipe" });
    const entries = execFileSync("unzip", ["-Z1", fileURLToPath(archive)], { encoding: "utf8" })
      .trim().split("\n").sort();
    assert.deepEqual(entries, [...target.files].sort(), "Archive must contain only runtime files.");
    const manifest = JSON.parse(execFileSync("unzip", ["-p", fileURLToPath(archive), "manifest.json"], {
      encoding: "utf8",
    }));
    assert.equal(manifest.version, version);
    const hash = createHash("sha256").update(await readFile(archive)).digest("hex");
    checksums.push(`${hash}  ${filename}`);
  }
  await writeFile(new URL("SHA256SUMS.txt", output), `${checksums.join("\n")}\n`);
  return fileURLToPath(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Packaged and verified resources in ${await packageRelease(new URL("../", import.meta.url))}`);
}

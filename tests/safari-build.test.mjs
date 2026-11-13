import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await read(path));

async function filesIn(url, prefix = "") {
  const entries = await readdir(url, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await filesIn(new URL(`${entry.name}/`, url), `${path}/`));
    } else {
      files.push(path);
    }
  }
  return files.sort();
}

test("Safari manifests and packaged resources are isolated by platform with narrow permissions", async () => {
  const edge = await json("public/manifest.json");
  const hosts = ["https://github.com/*", "https://repos.opensource.microsoft.com/*"];
  assert.deepEqual(edge.host_permissions, hosts);
  for (const target of ["macos", "ios"]) {
    const directory = new URL(`build/safari/${target}/`, root);
    const manifest = await json(`build/safari/${target}/manifest.json`);
    assert.equal(manifest.version, edge.version);
    assert.deepEqual(manifest.permissions, target === "macos" ? ["activeTab", "contextMenus"] : ["activeTab"]);
    assert.deepEqual(manifest.host_permissions, hosts);
    for (const forbidden of ["content_scripts", "minimum_chrome_version", "web_accessible_resources"]) {
      assert.equal(manifest[forbidden], undefined);
    }
    for (const icon of Object.values(manifest.icons)) {
      await access(new URL(icon, directory));
    }
    const files = await filesIn(directory);
    const common = ["repo-url.js", "navigation.js", "manifest.json", ...Object.values(manifest.icons)];
    if (target === "macos") {
      assert.equal(manifest.action.default_popup, undefined);
      assert.equal(manifest.commands._execute_action.suggested_key.mac, "Alt+Shift+O");
      await access(new URL(manifest.background.service_worker, directory));
      assert.deepEqual(files, [...common, "desktop-actions.js", "safari/macos-background.js"].sort());
    } else {
      assert.equal(manifest.background, undefined);
      assert.equal(manifest.commands, undefined);
      const popup = await read(`build/safari/${target}/${manifest.action.default_popup}`);
      for (const [, asset] of popup.matchAll(/(?:src|href)="([^"]+)"/g)) {
        await access(new URL(asset, directory));
      }
      assert.doesNotMatch(popup, /<script[^>]*>[^<]*\S[^<]*<\/script>|on(?:click|load)=|https?:\/\//);
      assert.deepEqual(files, [
        ...common, "popup.html", "popup.css", "safari/theme.js",
        "safari/ios-popup.js", "safari/popup-controller.js",
      ].sort());
    }
  }
});

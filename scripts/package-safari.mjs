import { spawnSync } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const [target, option, identifier, ...extra] = process.argv.slice(2);
if (
  !["macos", "ios"].includes(target) || option !== "--bundle-identifier" ||
  !identifier || !/^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)+$/.test(identifier) || extra.length
) {
  throw new Error("Usage: npm run package:safari -- <macos|ios> --bundle-identifier <authorized.reverse.dns.id>");
}
const root = new URL("../", import.meta.url);
const appName = `Open Source Portal Link ${target === "macos" ? "macOS" : "iPhone"}`;
const projectLocation = new URL(`apple/${target}/`, root);
try {
  await access(projectLocation);
  throw new Error("The generated project already exists. Rebuild extension resources and use the existing project; do not overwrite native changes.");
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}
const tool = ["safari-web-extension-packager", "safari-web-extension-converter"].find(
  (name) => spawnSync("xcrun", ["--find", name], { stdio: "ignore" }).status === 0,
);
if (!tool) {
  throw new Error("Safari packaging requires full Xcode and its Safari web extension packager. Command Line Tools alone are not sufficient. No project was generated.");
}
const build = spawnSync(process.execPath, ["scripts/build-safari.mjs", target], {
  cwd: root, stdio: "inherit",
});
if (build.status !== 0 || build.error) {
  throw new Error("Safari resources did not build; packaging stopped.");
}
await mkdir(new URL("apple/", root), { recursive: true });
const packaged = spawnSync("xcrun", [
  tool,
  fileURLToPath(new URL(`build/safari/${target}/`, root)),
  "--project-location", fileURLToPath(projectLocation),
  "--app-name", appName,
  "--bundle-identifier", identifier,
  `--${target === "macos" ? "macos" : "ios"}-only`,
  "--swift", "--no-open", "--no-prompt",
], { cwd: root, stdio: "inherit" });
if (packaged.status !== 0 || packaged.error) {
  throw new Error("Apple's Safari packager failed. Review its output; no signing or upload was attempted.");
}
console.log(`Created ${target} project in ${fileURLToPath(projectLocation)}; resources reference build/safari/${target}/.`);
console.log("Select an authorized signing team in Xcode. No signing, account changes, upload, or publication was performed.");

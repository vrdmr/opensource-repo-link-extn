import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const target = process.argv[2] ?? "all";
if (!["all", "macos", "ios"].includes(target) || process.argv.length > 3) {
  throw new Error("Usage: node scripts/build-safari.mjs [all|macos|ios]");
}
const edge = JSON.parse(await readFile(new URL("public/manifest.json", root), "utf8"));
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (pkg.version !== edge.version) {
  throw new Error("Package and Edge manifest versions must agree.");
}
for (const platform of target === "all" ? ["macos", "ios"] : [target]) {
  const output = new URL(`build/safari/${platform}/`, root);
  await rm(output, { recursive: true, force: true });
  const compile = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("node_modules/typescript/bin/tsc", root)), "--project", `tsconfig.safari-${platform}.json`],
    { cwd: root, stdio: "inherit" },
  );
  if (compile.error || compile.status !== 0) {
    throw new Error(`Safari ${platform} compilation failed. Install dependencies with npm ci if needed.`);
  }
  const manifest = JSON.parse(await readFile(new URL(`safari/${platform}/manifest.json`, root), "utf8"));
  if (manifest.version !== edge.version) {
    throw new Error(`Safari ${platform} version must match the package/Edge version.`);
  }
  await mkdir(output, { recursive: true });
  await cp(new URL(`safari/${platform}/manifest.json`, root), new URL("manifest.json", output));
  await cp(new URL("public/icons/", root), new URL("icons/", output), { recursive: true });
  if (platform === "ios") {
    for (const asset of ["popup.html", "popup.css"]) {
      await cp(new URL(`safari/ios/${asset}`, root), new URL(asset, output));
    }
  }
  console.log(`Built Safari ${platform}: ${fileURLToPath(output)}`);
}

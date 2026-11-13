import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const executable = process.argv[2];
assert.ok(executable, "Pass the path to a Microsoft Edge executable.");
await access(executable);
const profile = await mkdtemp(join(tmpdir(), "portal-link-browser-"));
const extensionPath = fileURLToPath(new URL("../dist/", import.meta.url));
const browser = spawn(executable, [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-sync",
  `--disable-extensions-except=${extensionPath}`,
  `--load-extension=${extensionPath}`,
  "about:blank",
], { stdio: "ignore" });
const exited = new Promise((resolve) => browser.once("exit", resolve));
let spawnError;
browser.once("error", (error) => { spawnError = error; });
let socket;
let sequence = 0;
const pending = new Map();
const handlers = new Map();

function send(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function evaluate(sessionId, expression) {
  const response = await send("Runtime.evaluate", {
    expression, awaitPromise: true, returnByValue: true,
  }, sessionId);
  assert.equal(response.exceptionDetails, undefined, JSON.stringify(response.exceptionDetails));
  return response.result.value;
}

async function attachWorker() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { targetInfos } = await send("Target.getTargets");
    const worker = targetInfos.find(({ type, url }) =>
      type === "service_worker" && url.startsWith("chrome-extension://") &&
      url.endsWith("/service-worker.js"));
    if (worker) {
      const { sessionId } = await send("Target.attachToTarget", {
        targetId: worker.targetId, flatten: true,
      });
      for (let ready = 0; ready < 50; ready++) {
        const { result } = await send("Runtime.evaluate", {
          expression: 'typeof chrome !== "undefined" && !!chrome.action?.onClicked.hasListeners() && !!chrome.contextMenus?.onClicked.hasListeners()',
          returnByValue: true,
        }, sessionId);
        if (result.value === true) return sessionId;
        await delay(100);
      }
      throw new Error("The extension service worker did not finish initializing.");
    }
    await delay(100);
  }
  throw new Error("The unpacked extension service worker did not load.");
}

async function fixture(url, newWindow = false) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank", newWindow });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] }, sessionId);
  await send("Page.navigate", { url }, sessionId);
  await delay(200);
  await send("Target.activateTarget", { targetId });
  return { targetId, sessionId };
}

async function shortcut(page) {
  await send("Target.activateTarget", { targetId: page.targetId });
  for (const type of ["rawKeyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type, key: "O", code: "KeyO", modifiers: 9,
      windowsVirtualKeyCode: 79,
      nativeVirtualKeyCode: process.platform === "darwin" ? 31 : 79,
    }, page.sessionId);
  }
}

async function expectDestination(page, expectedUrl) {
  const expectedOrigin = new URL(expectedUrl).origin;
  const before = (await send("Target.getTargets")).targetInfos;
  const existing = new Set(before.map(({ targetId }) => targetId));
  await shortcut(page);
  for (let attempt = 0; attempt < 30; attempt++) {
    const { targetInfos } = await send("Target.getTargets");
    const created = targetInfos.filter(({ targetId, type }) =>
      type === "page" && !existing.has(targetId));
    if (created.some(({ url }) => url.startsWith(`${expectedOrigin}/`))) {
      assert.equal(created.length, 1, "An invocation must create exactly one tab.");
      assert.equal(created[0].url, expectedUrl);
      return created[0];
    }
    await delay(100);
  }
  throw new Error("Native keyboard invocation did not open the expected destination.");
}

async function expectReuse(page, workerSession, existing) {
  const before = await evaluate(workerSession, "chrome.tabs.query({})");
  await shortcut(page);
  for (let attempt = 0; attempt < 30; attempt++) {
    const active = await evaluate(workerSession, `chrome.tabs.get(${existing.id})`);
    if (active.active) {
      assert.equal(active.url, existing.url, "Reuse must preserve the existing page.");
      const after = await evaluate(workerSession, "chrome.tabs.query({})");
      assert.deepEqual(after.map(({ id }) => id).sort(), before.map(({ id }) => id).sort(),
        "Reuse must not create or remove tabs.");
      return;
    }
    await delay(100);
  }
  throw new Error("Native keyboard invocation did not activate the existing destination.");
}

try {
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (browser.exitCode !== null) throw new Error(`Browser exited: ${browser.exitCode}`);
    try {
      const [port, path] = (await readFile(join(profile, "DevToolsActivePort"), "utf8"))
        .trim().split("\n");
      endpoint = `ws://127.0.0.1:${port}${path}`;
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(endpoint, "Headless browser did not become ready.");
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (request) {
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    } else {
      handlers.get(message.method)?.(message);
    }
  });
  handlers.set("Fetch.requestPaused", (message) => {
    void send("Fetch.fulfillRequest", {
      requestId: message.params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "text/html" }],
      body: Buffer.from("<!doctype html><title>Local URL fixture</title><p>Extension test fixture</p>")
        .toString("base64"),
    }, message.sessionId).catch(() => {});
  });

  const { product } = await send("Browser.getVersion");
  assert.match(product, /^Edg\//, "This smoke test requires Microsoft Edge.");
  console.log("Browser:", product);
  let workerSession = await attachWorker();
  const manifest = await evaluate(workerSession, "chrome.runtime.getManifest()");
  assert.equal(manifest.name, "Open Source Portal Link");
  assert.equal(manifest.background.type, "module");
  const permissions = await evaluate(workerSession, "chrome.permissions.getAll()");
  assert.deepEqual(permissions.permissions.sort(), ["activeTab", "contextMenus"]);
  assert.deepEqual(permissions.origins.sort(), [
    "https://github.com/*", "https://repos.opensource.microsoft.com/*",
  ]);
  const commands = await evaluate(workerSession, "chrome.commands.getAll()");
  assert.ok(commands.find(({ name }) => name === "_execute_action")?.shortcut);
  let menuReady = false;
  for (let attempt = 0; !menuReady && attempt < 50; attempt++) {
    menuReady = await evaluate(workerSession,
      'Promise.all(["open-source-portal", "open-source-overview", "open-source-jit", "open-github"].map(id => chrome.contextMenus.update(id, {enabled: true}).then(() => true, () => false))).then(results => results.every(Boolean))');
    if (!menuReady) await delay(100);
  }
  assert.ok(menuReady, "Installation did not register all Overview/JIT and reverse menus.");
  assert.equal(await evaluate(workerSession, "chrome.action.onClicked.hasListeners()"), true);
  assert.equal(await evaluate(workerSession, "chrome.contextMenus.onClicked.hasListeners()"), true);
  console.log("PASS: module worker, native permissions, menu, listeners, and shortcut registration");

  const page = await fixture(
    "https://github.com/Azure-Samples/Durable-Task-Scheduler/issues/42",
  );
  const tabsBefore = await evaluate(workerSession, "chrome.tabs.query({})");
  const source = tabsBefore.reduce((last, tab) => tab.id > last.id ? tab : last);
  assert.equal(source.url,
    "https://github.com/Azure-Samples/Durable-Task-Scheduler/issues/42",
    "Approved GitHub host access should expose matching tab URLs.");
  const portal = await expectDestination(
    page,
    "https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler",
  );
  const tabsAfter = await evaluate(workerSession, "chrome.tabs.query({})");
  const opened = tabsAfter.find(({ id }) => !tabsBefore.some((tab) => tab.id === id));
  assert.equal(opened.windowId, source.windowId);
  assert.equal(opened.active, true);
  assert.ok(tabsAfter.some(({ id }) => id === source.id));
  await send("Target.closeTarget", { targetId: portal.targetId });
  console.log("PASS: user gesture opens one focused overview in the source window with narrow host access");

  const portalFixture = await fixture(
    "https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler?view=kept#details",
  );
  const overviewTab = (await evaluate(workerSession, "chrome.tabs.query({})"))
    .find(({ url }) => url?.endsWith("?view=kept#details"));
  assert.ok(overviewTab);
  assert.equal(overviewTab.windowId, source.windowId);
  await expectReuse(page, workerSession, overviewTab);
  await expectReuse(portalFixture, workerSession, source);
  await send("Target.closeTarget", { targetId: portalFixture.targetId });
  console.log("PASS: native shortcut reuses Overview and GitHub subpage tabs without navigation or duplication");

  const jitFixture = await fixture(
    "https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler/jit",
  );
  const distinctOverview = await expectDestination(
    page, "https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler",
  );
  await send("Target.closeTarget", { targetId: distinctOverview.targetId });
  await send("Target.closeTarget", { targetId: jitFixture.targetId });
  console.log("PASS: an existing JIT tab is not reused for an Overview action");

  for (const url of [
    "https://example.com", "https://github.com/other/repo",
    "https://repos.opensource.microsoft.com/orgs/other/repos/repo/jit",
    "https://repos.opensource.microsoft.com/orgs/Azure",
  ]) {
    await send("Page.navigate", { url }, page.sessionId);
    await delay(200);
    const before = (await send("Target.getTargets")).targetInfos;
    await shortcut(page);
    await delay(500);
    const after = (await send("Target.getTargets")).targetInfos;
    assert.equal(after.filter(({ type }) => type === "page").length,
      before.filter(({ type }) => type === "page").length);
    assert.equal(await evaluate(workerSession,
      `chrome.action.getBadgeText({tabId: ${source.id}})`), "!");
  }
  console.log("PASS: unsupported origins and repository routes open nothing and show feedback");

  await send("Page.navigate", { url: "https://github.com/Azure/repository" }, page.sessionId);
  await delay(200);
  await evaluate(page.sessionId, 'history.pushState({}, "", "/dotnet/runtime/pull/42/files")');
  const changed = await expectDestination(page, "https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime");
  assert.equal(await evaluate(workerSession,
    `chrome.action.getBadgeText({tabId: ${source.id}})`), "");
  await send("Target.closeTarget", { targetId: changed.targetId });
  console.log("PASS: client-side repository navigation uses the current URL and clears old feedback");

  let versionId;
  handlers.set("ServiceWorker.workerVersionUpdated", ({ params }) => {
    for (const version of params.versions) {
      if (version.scriptURL?.endsWith("/service-worker.js")) versionId = version.versionId;
    }
  });
  await send("ServiceWorker.enable", {}, page.sessionId);
  for (let attempt = 0; !versionId && attempt < 20; attempt++) await delay(100);
  assert.ok(versionId, "Could not identify the extension's service worker to test restart.");
  await send("Target.detachFromTarget", { sessionId: workerSession });
  await send("ServiceWorker.stopWorker", { versionId }, page.sessionId);
  const restarted = await expectDestination(page, "https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime");
  await send("Target.closeTarget", { targetId: restarted.targetId });
  workerSession = await attachWorker();
  console.log("PASS: native shortcut wakes a stopped service worker");

  const otherWindowPortal = await fixture(
    "https://repos.opensource.microsoft.com/orgs/microsoft/repos/vscode",
  );
  const second = await fixture("https://github.com/microsoft/vscode/blob/main/README.md", true);
  const secondBefore = await evaluate(workerSession, "chrome.tabs.query({})");
  const secondSource = secondBefore.reduce((last, tab) => tab.id > last.id ? tab : last);
  assert.notEqual(secondSource.windowId, source.windowId);
  const secondPortal = await expectDestination(second, "https://repos.opensource.microsoft.com/orgs/microsoft/repos/vscode");
  const secondAfter = await evaluate(workerSession, "chrome.tabs.query({})");
  const secondOpened = secondAfter.find(({ id }) => !secondBefore.some((tab) => tab.id === id));
  assert.equal(secondOpened.windowId, secondSource.windowId);
  assert.equal(secondOpened.active, true);
  await send("Target.closeTarget", { targetId: secondPortal.targetId });
  await send("Target.closeTarget", { targetId: otherWindowPortal.targetId });
  console.log("PASS: a matching tab in another window is not reused; new tab stays in the source window");

  for (const suffix of ["", "/jit?query=1#fragment"]) {
    await send("Page.navigate", {
      url: `https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler${suffix}`,
    }, second.sessionId);
    await delay(200);
    const before = await evaluate(workerSession, "chrome.tabs.query({})");
    const github = await expectDestination(
      second, "https://github.com/Azure-Samples/Durable-Task-Scheduler",
    );
    const after = await evaluate(workerSession, "chrome.tabs.query({})");
    const returned = after.filter(({ id }) => !before.some((tab) => tab.id === id));
    assert.equal(returned.length, 1);
    assert.equal(returned[0].windowId, secondSource.windowId);
    assert.equal(returned[0].active, true);
    assert.ok(after.some(({ id }) => id === secondSource.id));
    await send("Target.closeTarget", { targetId: github.targetId });
  }
  console.log("PASS: portal overview and JIT shortcuts open the GitHub root in the source window");
  console.log("NOT COVERED: visible toolbar/menu clicks, menu visibility across contexts, portal sign-in.");
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await send("Browser.close").catch(() => {});
    socket.close();
  }
  if (browser.exitCode === null) browser.kill("SIGTERM");
  if (!spawnError) await exited;
  for (const { timer } of pending.values()) clearTimeout(timer);
  await rm(profile, { recursive: true, force: true });
}

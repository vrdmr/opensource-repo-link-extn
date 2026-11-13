import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { createPopupController } from "../build/safari/ios/safari/popup-controller.js";

const source = {
  id: 17, windowId: 3, active: true, incognito: false,
  url: "https://github.com/Azure-Samples/Durable-Task-Scheduler/issues/42",
};
const portal = "https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler";

function harness(tab = source) {
  const states = [];
  const tabs = {
    query: mock.fn(async () => [{ ...tab }]),
    get: mock.fn(async () => ({ ...tab })),
    update: mock.fn(async () => ({})),
    create: mock.fn(async () => ({ id: 99 })),
  };
  const close = mock.fn();
  const controller = createPopupController(tabs, (state) => states.push(state), close);
  return { tabs, close, states, controller, state: () => states.at(-1) };
}

afterEach(() => {
  delete globalThis.chrome;
  delete globalThis.window;
  delete globalThis.document;
});

test("iPhone popup imports without desktop APIs and opening it does not navigate", async () => {
  const h = harness();
  await h.controller.load();
  assert.equal(h.state().kind, "ready");
  assert.deepEqual(h.state().actions, ["overview", "jit"]);
  assert.equal(h.state().repository, "Azure-Samples/Durable-Task-Scheduler");
  assert.deepEqual(h.tabs.query.mock.calls[0].arguments[0], { active: true, currentWindow: true });
  assert.equal(h.tabs.create.mock.callCount(), 0);
  await h.controller.open("github");
  assert.equal(h.tabs.create.mock.callCount(), 0);
});

test("iPhone actions open exact Overview/JIT destinations or the portal's GitHub root", async () => {
  for (const [url, action, expected, actions] of [
    [source.url, "overview", portal, ["overview", "jit"]],
    [source.url, "jit", `${portal}/jit`, ["overview", "jit"]],
    [`${portal}/jit?private=ignored#hash`, "github",
      "https://github.com/Azure-Samples/Durable-Task-Scheduler", ["github"]],
  ]) {
    const h = harness({ ...source, url });
    await h.controller.load();
    assert.deepEqual(h.state().actions, actions);
    await h.controller.open(action);
    assert.deepEqual(h.tabs.get.mock.calls[0].arguments, [source.id]);
    assert.deepEqual(h.tabs.create.mock.calls[0].arguments[0], {
      url: expected, active: true, windowId: source.windowId,
    });
    assert.equal(h.state().kind, "opened");
    assert.equal(h.close.mock.callCount(), 1);
  }
});

test("unsupported, missing, denied, ambiguous and navigating source tabs offer no actions", async () => {
  for (const tab of [
    { ...source, url: "https://example.com/?url=https://github.com/dotnet/runtime" },
    { ...source, url: "https://github.com/other/repo" },
    { ...source, url: "https://repos.opensource.microsoft.com/orgs/Azure" },
    { ...source, url: undefined },
    { ...source, id: -1 },
    { ...source, pendingUrl: "https://github.com/dotnet/runtime" },
  ]) {
    const h = harness(tab);
    await h.controller.load();
    assert.ok(["unsupported", "unavailable"].includes(h.state().kind));
    assert.deepEqual(h.state().actions, []);
    await h.controller.open("overview");
    assert.equal(h.tabs.create.mock.callCount(), 0);
  }
  for (const query of [
    async () => [],
    async () => [source, { ...source, id: 18 }],
    async () => { throw new Error("private site details"); },
  ]) {
    const h = harness();
    h.tabs.query.mock.mockImplementation(query);
    await h.controller.load();
    assert.equal(h.state().kind, "unavailable");
    assert.doesNotMatch(JSON.stringify(h.states), /private site details/);
  }
});

test("changed or closed source, revoked URL access and switched tabs never fall back", async () => {
  for (const change of [
    { url: "https://github.com/dotnet/runtime" },
    { url: `${source.url}#changed` },
    { url: undefined },
    { id: 18 },
    { active: false },
    { windowId: 8 },
    { incognito: true },
    { pendingUrl: "https://example.com" },
  ]) {
    const h = harness();
    await h.controller.load();
    h.tabs.get.mock.mockImplementation(async () => ({ ...source, ...change }));
    await h.controller.open("jit");
    assert.equal(h.state().kind, "unavailable");
    assert.equal(h.tabs.create.mock.callCount(), 0);
  }
  for (const query of [async () => [], async () => [{ ...source, id: 42 }]]) {
    const h = harness();
    await h.controller.load();
    h.tabs.query.mock.mockImplementation(query);
    await h.controller.open("overview");
    assert.equal(h.tabs.create.mock.callCount(), 0);
    assert.equal(h.state().kind, "unavailable");
  }
  const h = harness();
  await h.controller.load();
  h.tabs.get.mock.mockImplementation(async () => { throw new Error("closed"); });
  await h.controller.open("overview");
  assert.equal(h.state().kind, "unavailable");
  assert.equal(h.tabs.create.mock.callCount(), 0);
});

test("rapid taps while reading or creating a tab cause only one navigation", async () => {
  for (const pendingMethod of ["get", "create"]) {
    const h = harness();
    await h.controller.load();
    let finish;
    h.tabs[pendingMethod].mock.mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    const opening = h.controller.open("overview");
    await new Promise((resolve) => setImmediate(resolve));
    await h.controller.open("jit");
    assert.equal(h.state().kind, "opening");
    assert.equal(h.close.mock.callCount(), 0);
    finish(pendingMethod === "get" ? { ...source } : { id: 99 });
    await opening;
    await h.controller.open("overview");
    assert.equal(h.tabs.create.mock.callCount(), 1);
    assert.equal(h.close.mock.callCount(), 1);
  }
});

test("confirmed creation failure leaves the popup open for a source-revalidated retry", async () => {
  const h = harness();
  await h.controller.load();
  h.tabs.create.mock.mockImplementation(async () => { throw new Error("private URL"); });
  await h.controller.open("jit");
  assert.equal(h.state().kind, "failed");
  assert.equal(h.close.mock.callCount(), 0);
  assert.doesNotMatch(h.state().message, /private URL/);
  h.tabs.create.mock.mockImplementation(async () => ({ id: 99 }));
  await h.controller.open("jit");
  assert.equal(h.tabs.get.mock.callCount(), 2);
  assert.equal(h.tabs.create.mock.callCount(), 2);
  assert.equal(h.close.mock.callCount(), 1);
});

test("disposing a popup cancels pending source reads and does not navigate", async () => {
  const h = harness();
  await h.controller.load();
  let finish;
  h.tabs.get.mock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const opening = h.controller.open("overview");
  await new Promise((resolve) => setImmediate(resolve));
  h.controller.dispose();
  finish(source);
  await opening;
  await h.controller.open("jit");
  assert.equal(h.tabs.create.mock.callCount(), 0);
  assert.equal(h.close.mock.callCount(), 0);
});

test("mobile popup can navigate when Safari omits a usable desktop window ID", async () => {
  const h = harness({ ...source, windowId: undefined });
  await h.controller.load();
  await h.controller.open("overview");
  assert.deepEqual(h.tabs.create.mock.calls[0].arguments[0], { url: portal, active: true });
});

test("mobile popup switches to an existing matching tab and closes only after activation", async () => {
  const h = harness();
  const existing = { ...source, id: 42, url: `${portal}/jit?view=kept#requests` };
  h.tabs.query.mock.mockImplementation(async (query) => query.url ? [existing] : [source]);
  h.tabs.get.mock.mockImplementation(async (id) => id === source.id ? source : existing);
  await h.controller.load();
  let finish;
  h.tabs.update.mock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const opening = h.controller.open("jit");
  await new Promise((resolve) => setImmediate(resolve));
  await h.controller.open("jit");
  assert.equal(h.close.mock.callCount(), 0);
  finish({});
  await opening;
  assert.equal(h.tabs.update.mock.callCount(), 1);
  assert.deepEqual(h.tabs.update.mock.calls[0].arguments, [existing.id, { active: true }]);
  assert.equal(h.tabs.create.mock.callCount(), 0);
  assert.equal(h.close.mock.callCount(), 1);
  assert.match(h.state().message, /Switched/);
});

test("dismissing the mobile popup during reuse lookup cancels navigation", async () => {
  const h = harness();
  await h.controller.load();
  let finish;
  h.tabs.query.mock.mockImplementation((query) => query.url
    ? new Promise((resolve) => { finish = resolve; })
    : Promise.resolve([source]));
  const opening = h.controller.open("overview");
  await new Promise((resolve) => setImmediate(resolve));
  h.controller.dispose();
  finish([{ ...source, id: 42, url: portal }]);
  await opening;
  assert.equal(h.tabs.update.mock.callCount(), 0);
  assert.equal(h.tabs.create.mock.callCount(), 0);
});

test("popup DOM wires buttons, busy state, plain repository text and success closure", async () => {
  const listeners = new Map();
  const elements = new Map(["status", "repository", "actions", "overview", "jit", "github"].map(
    (id) => [id, {
      textContent: "", hidden: true, disabled: true, attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(event, handler) { listeners.set(`${id}:${event}`, handler); },
    }],
  ));
  const h = harness();
  globalThis.chrome = { tabs: h.tabs };
  globalThis.document = {
    visibilityState: "visible",
    getElementById: (id) => elements.get(id),
    addEventListener: (event, handler) => listeners.set(event, handler),
  };
  globalThis.window = {
    close: h.close,
    addEventListener: (event, handler) => listeners.set(event, handler),
  };
  await import("../build/safari/ios/safari/ios-popup.js");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(elements.get("repository").textContent, "Azure-Samples/Durable-Task-Scheduler");
  assert.equal(elements.get("jit").hidden, false);
  assert.equal(elements.get("jit").disabled, false);
  assert.equal(elements.get("github").hidden, true);
  listeners.get("jit:click")();
  assert.equal(elements.get("jit").disabled, true);
  assert.equal(elements.get("actions").attributes["aria-busy"], "true");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.tabs.create.mock.calls[0].arguments[0].url, `${portal}/jit`);
  assert.equal(h.close.mock.callCount(), 1);
  assert.equal(elements.get("overview").disabled, true);
});

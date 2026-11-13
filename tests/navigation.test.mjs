import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { navigateRepository } from "../build/safari/ios/navigation.js";

const source = {
  id: 17, windowId: 3, incognito: false, url: "https://github.com/dotnet/runtime",
};
const portal = "https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime";
const candidate = {
  id: 42, windowId: 3, incognito: false, url: portal,
};

function harness(candidates = []) {
  return {
    query: mock.fn(async () => candidates),
    get: mock.fn(async (id) => candidates.find((tab) => tab.id === id)),
    update: mock.fn(async () => ({})),
    create: mock.fn(async () => ({})),
  };
}

test("shared navigator preserves source-window placement and fixed destination direction", async () => {
  const tabs = harness();
  assert.deepEqual(await navigateRepository(source, "jit", tabs), { ok: true, reused: false });
  assert.deepEqual(tabs.create.mock.calls[0].arguments[0], {
    url: "https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime/jit",
    active: true,
    windowId: 3,
  });
  for (const [tab, action] of [
    [source, "github"],
    [{ ...source, url: "https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime" }, "jit"],
    [source, "https://example.com"],
    [{ ...source, pendingUrl: "https://github.com/microsoft/vscode" }, "overview"],
  ]) {
    assert.equal((await navigateRepository(tab, action, tabs)).ok, false);
  }
  assert.equal(tabs.create.mock.callCount(), 1);
  assert.equal(tabs.query.mock.callCount(), 1);
});

test("mobile navigation tolerates an unavailable window ID without weakening desktop source checks", async () => {
  const tabs = harness([candidate]);
  const tab = { id: 17, url: source.url };
  assert.deepEqual(await navigateRepository(tab, "overview", tabs), {
    ok: false, reason: "missing-source",
  });
  assert.deepEqual(await navigateRepository(tab, "overview", tabs, { requireWindow: false }), {
    ok: true, reused: false,
  });
  assert.deepEqual(tabs.create.mock.calls[0].arguments[0], {
    url: "https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime", active: true,
  });
  for (const id of [undefined, -1, 0.5, NaN]) {
    assert.equal((await navigateRepository({ ...tab, id }, "overview", tabs, {
      requireWindow: false,
    })).ok, false);
  }
  assert.equal(tabs.query.mock.callCount(), 0);
  assert.equal(tabs.update.mock.callCount(), 0);
  assert.equal(tabs.create.mock.callCount(), 1);
});

test("shared navigator returns generic failures for synchronous and asynchronous API errors", async () => {
  for (const create of [
    () => { throw new Error("private browser URL"); },
    async () => { throw new Error("private browser URL"); },
  ]) {
    assert.deepEqual(await navigateRepository(source, "overview", { ...harness(), create }), {
      ok: false, reason: "opening-failed",
    });
  }
});

test("reverse navigation reuses a GitHub repository subpage without navigating or creating", async () => {
  for (const url of [
    "https://github.com/dotnet/runtime",
    "https://github.com/DotNet/Runtime/issues/42?query=kept#comment",
    "https://github.com/dotnet/%72untime/blob/main/file",
  ]) {
    const tabs = harness([{ ...candidate, url }]);
    assert.deepEqual(await navigateRepository({ ...source, url: `${portal}/jit` }, "github", tabs), {
      ok: true, reused: true,
    });
    assert.deepEqual(tabs.query.mock.calls[0].arguments[0], {
      windowId: source.windowId, url: "https://github.com/*",
    });
    assert.deepEqual(tabs.update.mock.calls[0].arguments, [candidate.id, { active: true }]);
    assert.equal(tabs.create.mock.callCount(), 0);
  }
});

test("portal reuse ignores query/fragment but keeps Overview, JIT and other sections separate", async () => {
  for (const [action, suffix, reused] of [
    ["overview", "", true],
    ["overview", "/?view=kept#details", true],
    ["overview", "/jit", false],
    ["overview", "/settings", false],
    ["jit", "", false],
    ["jit", "/jit?query=kept#section", true],
    ["jit", "/jit/requests/123", true],
    ["jit", "/jit-other", false],
    ["jit", "/settings/jit", false],
  ]) {
    const tabs = harness([{ ...candidate, url: `${portal}${suffix}` }]);
    assert.deepEqual(await navigateRepository(source, action, tabs), { ok: true, reused });
    assert.equal(tabs.update.mock.callCount(), reused ? 1 : 0);
    assert.equal(tabs.create.mock.callCount(), reused ? 0 : 1);
  }
});

test("reuse never crosses source-window, private-context, origin or repository boundaries", async () => {
  for (const changes of [
    { windowId: 8 },
    { incognito: true },
    { id: source.id },
    { id: -1 },
    { url: undefined },
    { url: `${portal}-other` },
    { url: "https://repos.opensource.microsoft.com/orgs/other/repos/runtime" },
    { url: "https://repos.opensource.microsoft.com.example.com/orgs/dotnet/repos/runtime" },
    { url: "https://user@repos.opensource.microsoft.com/orgs/dotnet/repos/runtime" },
    { pendingUrl: "https://example.com" },
  ]) {
    const tabs = harness([{ ...candidate, ...changes }]);
    assert.deepEqual(await navigateRepository(source, "overview", tabs), { ok: true, reused: false });
    assert.equal(tabs.update.mock.callCount(), 0);
    assert.equal(tabs.create.mock.callCount(), 1);
  }
});

test("candidates are revalidated after query and stale, moved or closed candidates fall back safely", async () => {
  for (const changes of [
    { url: `${portal}/jit` },
    { url: "https://example.com" },
    { url: undefined },
    { windowId: 8 },
    { incognito: true },
    { id: 101 },
    { pendingUrl: "https://example.com" },
  ]) {
    const tabs = harness([candidate]);
    tabs.get.mock.mockImplementation(async () => ({ ...candidate, ...changes }));
    assert.deepEqual(await navigateRepository(source, "overview", tabs), { ok: true, reused: false });
    assert.equal(tabs.update.mock.callCount(), 0);
    assert.equal(tabs.create.mock.callCount(), 1);
  }
  for (const method of ["query", "get", "update"]) {
    const tabs = harness([candidate]);
    tabs[method].mock.mockImplementation(async () => { throw new Error("private browser URL"); });
    assert.deepEqual(await navigateRepository(source, "overview", tabs), { ok: true, reused: false });
    assert.equal(tabs.create.mock.callCount(), 1);
  }
});

test("a failed candidate can be skipped in favor of another matching tab", async () => {
  const second = { ...candidate, id: 43 };
  const tabs = harness([candidate, second]);
  tabs.get.mock.mockImplementation(async (id) => {
    if (id === candidate.id) throw new Error("closed");
    return second;
  });
  assert.deepEqual(await navigateRepository(source, "overview", tabs), { ok: true, reused: true });
  assert.deepEqual(tabs.update.mock.calls[0].arguments, [second.id, { active: true }]);
  assert.equal(tabs.create.mock.callCount(), 0);
});

test("popup cancellation during destination lookup never activates or creates a tab", async () => {
  for (const method of ["query", "get"]) {
    const tabs = harness([candidate]);
    let cancelled = false;
    tabs[method].mock.mockImplementation(async () => {
      cancelled = true;
      return method === "query" ? [candidate] : candidate;
    });
    assert.deepEqual(await navigateRepository(source, "overview", tabs, {
      isCancelled: () => cancelled,
    }), { ok: false, reason: "cancelled" });
    assert.equal(tabs.update.mock.callCount(), 0);
    assert.equal(tabs.create.mock.callCount(), 0);
  }
});

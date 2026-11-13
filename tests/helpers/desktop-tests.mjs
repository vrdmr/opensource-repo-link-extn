import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

export function desktopTests(entry) {
  const source = {
    id: 17,
    windowId: 3,
    url: "https://github.com/Azure-Samples/Durable-Task-Scheduler/issues/42",
  };
  const destination =
    "https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler";
  let moduleId = 0;

  async function loadWorker() {
    const listeners = {};
    const menus = new Map();
    const badges = new Map();
    const titles = new Map();
    const warnings = mock.method(console, "warn", () => {});
    const createMenu = (properties, callback) => {
      assert.ok(!menus.has(properties.id), "menu ID must not be duplicated");
      if (properties.parentId) {
        assert.ok(menus.has(properties.parentId), "the submenu parent must exist first");
      }
      menus.set(properties.id, properties);
      callback();
      return properties.id;
    };
    const chrome = {
      runtime: {
        onInstalled: { addListener: (handler) => { listeners.install = handler; } },
      },
      contextMenus: {
        onClicked: { addListener: (handler) => { listeners.menu = handler; } },
        removeAll: mock.fn(async () => { menus.clear(); }),
        create: mock.fn(createMenu),
      },
      action: {
        onClicked: { addListener: (handler) => { listeners.action = handler; } },
        setBadgeText: mock.fn(async ({ tabId, text }) => { badges.set(tabId, text); }),
        setBadgeBackgroundColor: mock.fn(async () => {}),
        setTitle: mock.fn(async ({ tabId, title }) => { titles.set(tabId, title); }),
      },
      tabs: {
        query: mock.fn(async () => []),
        get: mock.fn(async () => { throw new Error("No matching tab"); }),
        update: mock.fn(async () => ({})),
        create: mock.fn(async () => ({ id: 99 })),
      },
    };
    globalThis.chrome = chrome;
    await import(`${entry}?test=${moduleId++}`);
    const settle = () => new Promise((resolve) => setImmediate(resolve));
    return { chrome, listeners, menus, badges, titles, warnings, settle, createMenu };
  }

  afterEach(() => {
    mock.restoreAll();
    delete globalThis.chrome;
  });

  test("creates scoped Overview/JIT and reverse menus and recreates them on update", async () => {
    const { chrome, listeners, menus, settle } = await loadWorker();
    for (const reason of ["install", "update"]) {
      listeners.install({ reason });
      await settle();
      assert.equal(menus.size, 4);
      for (const id of ["open-source-portal", "open-source-overview", "open-source-jit", "open-github"]) {
        const menu = menus.get(id);
        assert.deepEqual(menu.documentUrlPatterns, [
          id === "open-github"
            ? "https://repos.opensource.microsoft.com/orgs/*/repos/*"
            : "https://github.com/*/*",
        ]);
        assert.deepEqual(
          new Set(menu.contexts),
          new Set(["page", "selection", "link", "editable", "image", "audio", "video", "frame"]),
        );
        assert.equal(menu.targetUrlPatterns, undefined);
      }
      for (const id of ["open-source-overview", "open-source-jit"]) {
        assert.equal(menus.get(id).parentId, "open-source-portal");
      }
      assert.equal(menus.get("open-github").parentId, undefined);
    }
    assert.equal(chrome.contextMenus.removeAll.mock.callCount(), 2);
  });

  test("toolbar/shortcut action opens one focused portal tab in the source window", async () => {
    const { chrome, listeners, settle } = await loadWorker();
    listeners.action(source);
    await settle();
    assert.deepEqual(chrome.tabs.create.mock.calls.map(({ arguments: args }) => args), [
      [{ url: destination, active: true, windowId: source.windowId }],
    ]);
    listeners.action({ ...source, url: "https://github.com/dotnet/runtime", windowId: 8 });
    await settle();
    assert.deepEqual(chrome.tabs.create.mock.calls[1].arguments[0], {
      url: "https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime",
      active: true,
      windowId: 8,
    });
  });

  test("desktop actions activate an existing same-window repository tab without replacing its URL", async () => {
    const { chrome, listeners, badges, settle } = await loadWorker();
    const existing = {
      ...source, id: 42, url: "https://github.com/Azure-Samples/Durable-Task-Scheduler/pull/42",
    };
    chrome.tabs.query.mock.mockImplementation(async () => [existing]);
    chrome.tabs.get.mock.mockImplementation(async () => existing);
    listeners.action({ ...source, url: destination });
    await settle();
    assert.deepEqual(chrome.tabs.update.mock.calls[0].arguments, [existing.id, { active: true }]);
    assert.equal(chrome.tabs.create.mock.callCount(), 0);
    assert.equal(badges.get(source.id), "");
  });

  test("context menu uses the top-level source, never the clicked link or frame", async () => {
    const { chrome, listeners, settle } = await loadWorker();
    listeners.menu({
      menuItemId: "open-source-overview",
      linkUrl: "https://github.com/microsoft/vscode",
      frameUrl: "https://github.com/dotnet/runtime",
      pageUrl: "https://github.com/dotnet/runtime",
    }, source);
    await settle();
    assert.equal(chrome.tabs.create.mock.callCount(), 1);
    assert.equal(chrome.tabs.create.mock.calls[0].arguments[0].url, destination);
    listeners.menu({ menuItemId: "another-extension-item" }, source);
    await settle();
    assert.equal(chrome.tabs.create.mock.callCount(), 1);
  });

  test("an eligible link/frame cannot bypass an ineligible top-level source for any destination", async () => {
    const { chrome, listeners, badges, titles, settle } = await loadWorker();
    for (const url of [
      "https://example.com", "https://github.com/other/repo",
      "https://repos.opensource.microsoft.com/orgs/other/repos/repo/jit",
      "https://repos.opensource.microsoft.com/orgs/Azure",
    ]) {
      for (const menuItemId of ["open-source-overview", "open-source-jit", "open-github"]) {
        listeners.menu({
          menuItemId,
          linkUrl: source.url,
          frameUrl: destination,
          pageUrl: source.url,
        }, { ...source, url });
      }
      listeners.action({ ...source, url });
      await settle();
      assert.equal(chrome.tabs.create.mock.callCount(), 0);
      assert.equal(badges.get(source.id), "!");
      assert.match(titles.get(source.id), /supported GitHub repository/);
    }
  });

  test("missing URLs fail safely; missing source context never falls back to another tab", async () => {
    const { chrome, listeners, badges, settle } = await loadWorker();
    listeners.action({ id: source.id, windowId: source.windowId });
    await settle();
    assert.equal(badges.get(source.id), "!");
    chrome.action.setBadgeText.mock.resetCalls();
    for (const tab of [
      undefined, {}, { ...source, id: -1 }, { ...source, id: undefined },
      { ...source, windowId: undefined }, { ...source, windowId: -1 },
    ]) {
      listeners.menu({ menuItemId: "open-source-overview" }, tab);
      await settle();
    }
    assert.equal(chrome.tabs.create.mock.callCount(), 0);
    assert.equal(chrome.action.setBadgeText.mock.callCount(), 0);
  });

  test("a successful retry clears previous per-tab error feedback", async () => {
    const { listeners, badges, titles, settle } = await loadWorker();
    listeners.action({ ...source, url: "https://example.com" });
    await settle();
    assert.equal(badges.get(source.id), "!");
    listeners.action(source);
    await settle();
    assert.equal(badges.get(source.id), "");
    assert.equal(titles.get(source.id), "Open Source Portal or GitHub");
  });

  test("tab creation rejection is handled without leaking raw error details", async () => {
    const { chrome, listeners, badges, titles, warnings, settle } = await loadWorker();
    chrome.tabs.create.mock.mockImplementation(async () => {
      throw new Error("sensitive source URL");
    });
    listeners.action(source);
    await settle();
    assert.equal(badges.get(source.id), "!");
    assert.match(titles.get(source.id), /Could not open/);
    assert.ok(warnings.mock.callCount() > 0);
    assert.doesNotMatch(JSON.stringify(warnings.mock.calls), /sensitive source URL/);
  });

  test("badge/title promise failures cannot prevent a valid open or cause an unhandled rejection", async () => {
    const { chrome, listeners, settle } = await loadWorker();
    for (const method of ["setBadgeText", "setBadgeBackgroundColor", "setTitle"]) {
      chrome.action[method].mock.mockImplementation(async () => {
        throw new Error("source tab closed");
      });
    }
    listeners.action({ ...source, url: "https://example.com" });
    await settle();
    listeners.action(source);
    await settle();
    assert.equal(chrome.tabs.create.mock.callCount(), 1);
  });

  test("synchronous feedback API failures also remain best-effort", async () => {
    const { chrome, listeners, settle } = await loadWorker();
    chrome.action.setBadgeText.mock.mockImplementation(() => {
      throw new Error("tab no longer exists");
    });
    listeners.action({ ...source, url: "https://example.com" });
    await settle();
    listeners.action(source);
    await settle();
    assert.equal(chrome.tabs.create.mock.callCount(), 1);
  });

  test("menu callback errors and cleanup rejections are handled generically", async () => {
    const { chrome, listeners, warnings, settle } = await loadWorker();
    let errorRead = false;
    chrome.contextMenus.create.mock.mockImplementation((properties, callback) => {
      Object.defineProperty(chrome.runtime, "lastError", {
        configurable: true,
        get: () => { errorRead = true; return { message: "private details" }; },
      });
      callback();
      delete chrome.runtime.lastError;
      return properties.id;
    });
    listeners.install({ reason: "install" });
    await settle();
    assert.equal(errorRead, true);
    chrome.contextMenus.removeAll.mock.mockImplementation(async () => {
      throw new Error("private details");
    });
    listeners.install({ reason: "update" });
    await settle();
    assert.equal(warnings.mock.callCount(), 5);
    assert.doesNotMatch(JSON.stringify(warnings.mock.calls), /private details/);
  });

  test("the JIT menu opens only the current repository's JIT page", async () => {
    const { chrome, listeners, settle } = await loadWorker();
    listeners.menu({
      menuItemId: "open-source-jit",
      linkUrl: "https://github.com/dotnet/runtime",
      frameUrl: "https://github.com/microsoft/vscode",
    }, source);
    await settle();
    assert.deepEqual(chrome.tabs.create.mock.calls[0].arguments[0], {
      url: `${destination}/jit`, active: true, windowId: source.windowId,
    });
    assert.equal(chrome.tabs.create.mock.callCount(), 1);
  });

  test("portal menu and toolbar/shortcut return from overview or JIT to the GitHub root", async () => {
    const { chrome, listeners, settle } = await loadWorker();
    for (const suffix of ["", "/jit?query=1#fragment", "/jit/access"]) {
      const tab = { ...source, url: `${destination}${suffix}`, windowId: 8 };
      listeners.action(tab);
      listeners.menu({
        menuItemId: "open-github",
        linkUrl: "https://github.com/dotnet/runtime",
        frameUrl: "https://repos.opensource.microsoft.com/orgs/microsoft/repos/vscode",
      }, tab);
      await settle();
    }
    assert.equal(chrome.tabs.create.mock.callCount(), 6);
    for (const { arguments: [tab] } of chrome.tabs.create.mock.calls) {
      assert.deepEqual(tab, {
        url: "https://github.com/Azure-Samples/Durable-Task-Scheduler",
        active: true,
        windowId: 8,
      });
    }
  });

  test("direction-specific menu actions cannot operate on the opposite source site", async () => {
    const { chrome, listeners, badges, settle } = await loadWorker();
    for (const menuItemId of ["open-source-overview", "open-source-jit"]) {
      listeners.menu({ menuItemId }, { ...source, url: `${destination}/jit` });
    }
    listeners.menu({ menuItemId: "open-github" }, source);
    listeners.menu({ menuItemId: "open-source-portal" }, source);
    await settle();
    assert.equal(chrome.tabs.create.mock.callCount(), 0);
    assert.equal(badges.get(source.id), "!");
  });

  test("submenu children wait for the parent's asynchronous creation callback", async () => {
    const { chrome, listeners, menus, settle, createMenu } = await loadWorker();
    let finishParent;
    chrome.contextMenus.create.mock.mockImplementation((properties, callback) => {
      if (properties.id === "open-source-portal") {
        finishParent = () => createMenu(properties, callback);
        return properties.id;
      }
      return createMenu(properties, callback);
    });
    listeners.install({ reason: "install" });
    await settle();
    assert.equal(menus.size, 0);
    finishParent();
    await settle();
    assert.equal(menus.size, 4);
  });
}

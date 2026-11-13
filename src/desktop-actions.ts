import { navigateRepository, type Destination } from "./navigation.js";

const title = "Open Source Portal or GitHub";
const menuDestinations = new Map<string | number, Destination>([
  ["open-source-overview", "overview"],
  ["open-source-jit", "jit"],
  ["open-github", "github"],
]);

async function setFeedback(tabId: number, message?: string): Promise<void> {
  await Promise.allSettled([
    Promise.resolve().then(() =>
      chrome.action.setBadgeText({ tabId, text: message ? "!" : "" })),
    Promise.resolve().then(() =>
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#A4262C" })),
    Promise.resolve().then(() =>
      chrome.action.setTitle({ tabId, title: message ?? title })),
  ]);
}

async function openRepository(
  tab: chrome.tabs.Tab | undefined,
  destination: Destination = "default",
): Promise<void> {
  const result = await navigateRepository(
    tab,
    destination,
    {
      query: (query) => chrome.tabs.query(query),
      get: (id) => chrome.tabs.get(id),
      update: (id, properties) => chrome.tabs.update(id, properties),
      create: (properties) => chrome.tabs.create(properties),
    },
  );
  if (!result.ok && result.reason === "missing-source") {
    console.warn("Open Source Portal Link: no usable source tab.");
    return;
  }
  const tabId = tab!.id!;
  if (result.ok) {
    await setFeedback(tabId);
  } else if (result.reason === "unsupported") {
    await setFeedback(tabId, "Open a supported GitHub repository or its Open Source Portal page.");
  } else {
    await setFeedback(tabId, "Could not open the repository link. Try again from the source tab.");
    console.warn("Open Source Portal Link: could not open the destination tab.");
  }
}

async function setUpMenu(): Promise<void> {
  try {
    await chrome.contextMenus.removeAll();
    const githubMenus = [
      { id: "open-source-portal", title: "Microsoft Open Source Portal" },
      { id: "open-source-overview", parentId: "open-source-portal", title: "Open Overview" },
      { id: "open-source-jit", parentId: "open-source-portal", title: "Open JIT Access" },
    ];
    const menus = [
      ...githubMenus.map((menu) => ({
        ...menu,
        documentUrlPatterns: ["https://github.com/*/*"],
      })),
      {
        id: "open-github",
        title: "Open Repository on GitHub",
        documentUrlPatterns: ["https://repos.opensource.microsoft.com/orgs/*/repos/*"],
      },
    ];
    for (const menu of menus) {
      await new Promise<void>((resolve) => {
        chrome.contextMenus.create(
          {
            ...menu,
            contexts: [
              "page", "selection", "link", "editable",
              "image", "audio", "video", "frame",
            ],
          },
          () => {
            if (chrome.runtime.lastError) {
              console.warn("Open Source Portal Link: could not create the context menu.");
            }
            resolve();
          },
        );
      });
    }
  } catch {
    console.warn("Open Source Portal Link: could not set up the context menu.");
  }
}

export function registerDesktopActions(): void {
  chrome.runtime.onInstalled.addListener(() => {
    void setUpMenu();
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const destination = menuDestinations.get(info.menuItemId);
    if (destination) {
      void openRepository(tab, destination);
    }
  });
  chrome.action.onClicked.addListener((tab) => {
    void openRepository(tab);
  });
}

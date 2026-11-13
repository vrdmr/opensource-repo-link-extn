import { toGitHubUrl, toPortalUrl } from "./repo-url.js";

const title = "Open Source Portal or GitHub";
type Destination = "overview" | "jit" | "github" | "default";
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
  const tabId = tab?.id;
  if (
    !tab ||
    typeof tabId !== "number" ||
    !Number.isInteger(tabId) ||
    tabId < 0 ||
    !Number.isInteger(tab.windowId) ||
    tab.windowId < 0
  ) {
    console.warn("Open Source Portal Link: no usable source tab.");
    return;
  }

  const url = destination === "github"
    ? toGitHubUrl(tab.url)
    : destination === "default"
      ? toPortalUrl(tab.url) ?? toGitHubUrl(tab.url)
      : toPortalUrl(tab.url, destination);
  if (!url) {
    await setFeedback(tabId, "Open a supported GitHub repository or its Open Source Portal page.");
    return;
  }

  try {
    await chrome.tabs.create({ url, active: true, windowId: tab.windowId });
    await setFeedback(tabId);
  } catch {
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
        },
      );
    }
  } catch {
    console.warn("Open Source Portal Link: could not set up the context menu.");
  }
}

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

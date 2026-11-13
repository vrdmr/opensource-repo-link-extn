import { toGitHubUrl, toPortalUrl } from "./repo-url.js";

export type Destination = "overview" | "jit" | "github" | "default";
export type SourceTab = Partial<Pick<
  chrome.tabs.Tab,
  "id" | "windowId" | "url" | "pendingUrl" | "active" | "incognito"
>>;
export type CreateTab = (properties: chrome.tabs.CreateProperties) => Promise<unknown>;
export type NavigationTabs = {
  query: (query: chrome.tabs.QueryInfo) => Promise<SourceTab[]>;
  get: (id: number) => Promise<SourceTab>;
  update: (id: number, properties: chrome.tabs.UpdateProperties) => Promise<unknown>;
  create: CreateTab;
};
export type NavigationResult =
  | { ok: true; reused: boolean }
  | { ok: false; reason: "missing-source" | "unsupported" | "opening-failed" | "cancelled" };

export function usableId(id: number | undefined): id is number {
  return typeof id === "number" && Number.isInteger(id) && id >= 0;
}

export function destinationUrl(
  input: string | undefined,
  destination: Destination,
): string | null {
  switch (destination) {
    case "overview":
    case "jit":
      return toPortalUrl(input, destination);
    case "github":
      return toGitHubUrl(input);
    case "default":
      return toPortalUrl(input) ?? toGitHubUrl(input);
    default:
      return null;
  }
}

function matchesDestination(input: string | undefined, target: string): boolean {
  const destination = new URL(target);
  if (destination.origin === "https://github.com") {
    const repository = toPortalUrl(target);
    return repository !== null && toPortalUrl(input)?.toLowerCase() === repository.toLowerCase();
  }
  const repository = toGitHubUrl(target);
  if (!repository || toGitHubUrl(input)?.toLowerCase() !== repository.toLowerCase()) {
    return false;
  }
  const segments = new URL(input!).pathname.split("/");
  return destination.pathname.endsWith("/jit")
    ? segments[5] === "jit"
    : segments.slice(5).every((segment) => segment === "");
}

export async function navigateRepository(
  tab: SourceTab | undefined,
  destination: Destination,
  tabs: NavigationTabs,
  options: { requireWindow?: boolean; isCancelled?: () => boolean } = {},
): Promise<NavigationResult> {
  if (!tab || !usableId(tab.id) || (options.requireWindow !== false && !usableId(tab.windowId))) {
    return { ok: false, reason: "missing-source" };
  }
  if (tab.pendingUrl && tab.pendingUrl !== tab.url) {
    return { ok: false, reason: "unsupported" };
  }
  const url = destinationUrl(tab.url, destination);
  if (!url) {
    return { ok: false, reason: "unsupported" };
  }
  const cancelled = () => options.isCancelled?.() ?? false;
  const eligible = (candidate: SourceTab) =>
    usableId(candidate.id) && candidate.id !== tab.id &&
    candidate.windowId === tab.windowId && candidate.incognito === tab.incognito &&
    (!candidate.pendingUrl || candidate.pendingUrl === candidate.url) &&
    matchesDestination(candidate.url, url);

  if (cancelled()) {
    return { ok: false, reason: "cancelled" };
  }
  if (usableId(tab.windowId)) {
    try {
      const candidates = await tabs.query({
        windowId: tab.windowId,
        url: `${new URL(url).origin}/*`,
      });
      for (const candidate of candidates) {
        if (cancelled()) {
          return { ok: false, reason: "cancelled" };
        }
        if (!eligible(candidate)) {
          continue;
        }
        try {
          const current = await tabs.get(candidate.id!);
          if (cancelled()) {
            return { ok: false, reason: "cancelled" };
          }
          if (current.id !== candidate.id || !eligible(current)) {
            continue;
          }
          await tabs.update(current.id!, { active: true });
          return { ok: true, reused: true };
        } catch {
          // A candidate may close or move while the user invokes the action.
        }
      }
    } catch {
      // Missing site access must not prevent the original new-tab behavior.
    }
  }
  if (cancelled()) {
    return { ok: false, reason: "cancelled" };
  }
  try {
    await tabs.create({
      url,
      active: true,
      ...(usableId(tab.windowId) ? { windowId: tab.windowId } : {}),
    });
    return { ok: true, reused: false };
  } catch {
    return { ok: false, reason: "opening-failed" };
  }
}

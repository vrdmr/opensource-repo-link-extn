import {
  destinationUrl,
  navigateRepository,
  usableId,
  type Destination,
  type NavigationTabs,
  type SourceTab,
} from "../navigation.js";

type PopupDestination = Exclude<Destination, "default">;
export type PopupState = {
  kind: "loading" | "ready" | "unsupported" | "unavailable" | "opening" | "failed" | "opened";
  message: string;
  repository: string;
  actions: PopupDestination[];
};

const unavailable =
  "Cannot read this tab. Allow access in Safari, then reopen this extension from the repository page.";
const changed =
  "The source tab changed or closed. Reopen this extension from the repository page.";

function actionsFor(url: string | undefined): PopupDestination[] {
  if (destinationUrl(url, "overview")) {
    return ["overview", "jit"];
  }
  return destinationUrl(url, "github") ? ["github"] : [];
}

function labelFor(url: string, actions: PopupDestination[]): string {
  const github = actions.includes("github") ? destinationUrl(url, "github") : url;
  const parts = new URL(github!).pathname.split("/");
  return `${decodeURIComponent(parts[1]!)}/${decodeURIComponent(parts[2]!)}`;
}

export function createPopupController(
  tabs: NavigationTabs,
  render: (state: PopupState) => void,
  close: () => void,
) {
  let source: SourceTab | undefined;
  let disposed = false;
  let state: PopupState = {
    kind: "loading", message: "Reading the current repository...", repository: "", actions: [],
  };
  function update(next: PopupState) {
    state = next;
    if (!disposed) {
      render({ ...next, actions: [...next.actions] });
    }
  }
  function invalidate(message: string) {
    source = undefined;
    update({ kind: "unavailable", message, repository: "", actions: [] });
  }

  return {
    async load(): Promise<void> {
      if (disposed || state.kind !== "loading") {
        return;
      }
      update(state);
      try {
        const active = await tabs.query({ active: true, currentWindow: true });
        if (disposed) {
          return;
        }
        const tab = active.length === 1 ? active[0] : undefined;
        if (!tab || !usableId(tab.id) || !tab.url) {
          invalidate(unavailable);
          return;
        }
        if (tab.pendingUrl && tab.pendingUrl !== tab.url) {
          invalidate(changed);
          return;
        }
        const actions = actionsFor(tab.url);
        if (!actions.length) {
          update({
            kind: "unsupported",
            message: "Open a repository in a supported GitHub organization or its Open Source Portal page.",
            repository: "",
            actions: [],
          });
          return;
        }
        source = { ...tab };
        update({
          kind: "ready",
          message: "Choose a destination. Reuse a matching tab in this window or open a new one.",
          repository: labelFor(tab.url, actions),
          actions,
        });
      } catch {
        if (!disposed) {
          invalidate(unavailable);
        }
      }
    },
    async open(destination: PopupDestination): Promise<void> {
      if (
        disposed || !source || !usableId(source.id) ||
        !["ready", "failed"].includes(state.kind) || !state.actions.includes(destination)
      ) {
        return;
      }
      const captured = source;
      update({ ...state, kind: "opening", message: "Opening the repository link..." });
      let fresh: SourceTab;
      try {
        const active = await tabs.query({ active: true, currentWindow: true });
        if (disposed) {
          return;
        }
        fresh = await tabs.get(captured.id!);
        if (disposed) {
          return;
        }
        if (
          fresh.id !== captured.id || !fresh.url || fresh.url !== captured.url ||
          fresh.incognito !== captured.incognito || fresh.windowId !== captured.windowId ||
          fresh.active === false || active.length !== 1 || active[0]?.id !== captured.id ||
          (fresh.pendingUrl && fresh.pendingUrl !== fresh.url)
        ) {
          invalidate(changed);
          return;
        }
      } catch {
        if (!disposed) {
          invalidate(changed);
        }
        return;
      }
      const result = await navigateRepository(fresh, destination, tabs, {
        requireWindow: false,
        isCancelled: () => disposed,
      });
      if (disposed) {
        return;
      }
      if (result.ok) {
        update({
          ...state,
          kind: "opened",
          message: result.reused ? "Switched to the existing tab." : "Opened in a new tab.",
        });
        disposed = true;
        source = undefined;
        try {
          close();
        } catch {
          // A dismissed popup must not offer a second navigation after success.
        }
      } else if (result.reason === "opening-failed") {
        update({ ...state, kind: "failed", message: "Could not open the link. Try again." });
      } else {
        invalidate(changed);
      }
    },
    dispose(): void {
      disposed = true;
      source = undefined;
    },
  };
}

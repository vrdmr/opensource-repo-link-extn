# Open Source Portal Link

A small Microsoft Edge extension for opening a GitHub repository's Microsoft open source portal **Overview or JIT page**, and returning **from the portal to GitHub**.

**Safari for macOS and iPhone is planned, not available yet.** See [SAFARI_IMPLEMENTATION_PLAN.md](SAFARI_IMPLEMENTATION_PLAN.md) for the proposed desktop/mobile experience, implementation phases, and Apple packaging. The build and installation instructions below still apply only to Edge.

```text
https://github.com/Azure-Samples/Durable-Task-Scheduler/issues/42
    ->
https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler
```

## Build and install

Requires Node.js 22+ (tested with 24.16.0), npm, and desktop Microsoft Edge 123+. Edge is the only currently supported browser.

```sh
npm ci
npm test
```

`npm test` performs a clean TypeScript build and runs the automated tests. The loadable extension is in **`dist/`**, not the project root.

On this Microsoft-managed machine, the default npm proxy returned cross-host tarball URLs that npm 12 rejected with `EALLOWREMOTE`. A clean installation succeeded using the Microsoft registry advertised by that proxy:

```sh
npm ci --registry=https://ms-feed-25.pkgs.visualstudio.com/1es-public/_packaging/npm-public/npm/registry/
npm test
```

Use your approved registry. No user/global npm configuration was changed, and there is no need to relax npm's remote-package policy. The lockfile pins versions and integrity without embedding registry download URLs.

1. Open `edge://extensions`.
2. Enable **Developer mode**, choose **Load unpacked**, and select this project's **`dist/`** folder.
3. Pin **Open Source Portal Link** from the browser's Extensions menu.

There is no store listing yet. Hidden Edge Add-ons distribution is planned separately; no account registration or submission has been performed.

## Use

| Current page | Right-click action | Toolbar / Alt+Shift+O |
| --- | --- | --- |
| Supported GitHub repository | **Microsoft Open Source Portal → Open Overview** or **Open JIT Access** | Open Overview |
| Repository portal page, including `/jit` | **Open Repository on GitHub** | Open the GitHub repository root |

On macOS, the shortcut is **Option+Shift+O**. It works while the browser is focused. JIT is a right-click choice; the existing shortcut keeps its Overview default on GitHub.

Every action opens one new focused tab in the source window and leaves the original tab open. Repeated invocations create additional tabs. Right-clicking a link to another repository still uses the **current page's repository**, not the link target.

For example:

```text
GitHub:   https://github.com/Azure/azure-functions-agents-runtime/issues/42
Overview: https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime
JIT:      https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime/jit
Return:   https://github.com/Azure/azure-functions-agents-runtime
```

GitHub subpages use the same Overview/JIT destinations. Portal subpages always return to the GitHub repository root; query strings and fragments are not copied. Opening JIT only navigates to the page: it does not request, approve, or grant access.

**Updating from 0.1.0:** the built `dist/` is now version **0.2.0**. Click **Reload** for this extension on `edge://extensions` to pick up the new menus.

Supported organizations (case-insensitive):

```text
Azure
Azure-Samples
microsoft
MicrosoftDocs
dotnet
microsoftfeedback
microsoftarchive
microsofthackathons
```

Sources must use the exact `https://github.com/{org}/{repo}` or `https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}` route, optionally with subpages, for an organization in that list. Other websites, GitHub Enterprise, gists, organization-only pages, and unsupported organizations open nothing. A GitHub or portal link/frame embedded on another site does not qualify.

## Permissions and limitations

Only **`activeTab`** and **`contextMenus`** are requested. There are no persistent host permissions, content scripts, page modifications, analytics, credential handling, or runtime dependencies.

`activeTab` temporarily exposes the source URL following your explicit invocation. It is not hostname-scoped, so the handler enforces the two exact origins and supported repository routes itself. The extension extracts the organization/repository locally and includes only those path segments in the requested GitHub or portal navigation; source query strings, fragments, and nested paths are not copied.

The context menus use coarse GitHub/portal document/frame filters, so they may appear for unsupported paths. Frame visibility can vary. Every invocation still validates the top-level source URL and the chosen direction. The toolbar remains clickable elsewhere but opens nothing on ineligible pages.

The extension does **not** check repository existence, visibility, licensing, or portal onboarding. A valid-looking nonexistent repository still yields a destination. GitHub and the portal handle their own sign-in, authorization, missing-repository, and network errors.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Shortcut does nothing | Check assignment/conflicts at `edge://extensions/shortcuts`; remap if necessary |
| `!` badge | Hover over the pinned icon for the explanation; retry on an eligible repository |
| Old error badge after navigating | Feedback refreshes on the next invocation; the extension does not monitor browsing in the background |
| Portal requires sign-in or denies access | Use the portal's normal access process; the extension cannot grant access |
| Changes are not reflected | Run `npm run build`, then Reload the extension on the browser's Extensions page |
| Build failed | Fix the error and rebuild before reloading; the build removes stale `dist/` output first |

Inspect the extension's service worker and Errors entry on the Extensions page for generic diagnostics. Your existing browser profile is not modified by the automated smoke tests.

## Development and verification

`src/repo-url.ts` is the pure mapper; `src/service-worker.ts` connects the shared handler to the menu and toolbar/shortcut. TypeScript emits native ES modules. PNG icons are included in `public/icons/`; regenerate them with `node scripts/generate-icons.mjs` if changing the original geometric design.

The `chrome.*` API namespace, `@types/chrome`, and manifest's `minimum_chrome_version` remain intentional: these are Edge's Chromium extension API identifiers, not additional browser targets.

```sh
npm test
```

For an optional native headless smoke test, pass the Edge executable:

```sh
npm run test:edge -- "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
```

`tests/edge-smoke.mjs` verifies it is running Microsoft Edge and uses Node's built-in WebSocket/CDP support with a temporary browser profile, which is deleted afterward. It serves local test HTML at controlled GitHub/portal/unsupported URLs and exercises real shortcut navigation in both directions, permission grants, all four menu registrations, feedback, worker restart, and source-window behavior. Destination tabs can load GitHub or the real portal; authenticated access is not tested. No browser binary is downloaded by the script.

**Verified for 0.2.0:** strict build and 23 automated tests; expanded native headless smoke tests in Edge **157.0.4341.57** on macOS, including reverse navigation from portal Overview and JIT pages. The user also confirmed correct menu placement and working navigation in both directions.

**Remaining checks:** exhaustive context-menu visibility on selections/media/editable fields/frames and independently observed manual extension reload/update. The user's functional confirmation does not establish this full matrix or authenticated JIT access.

See [IDEAS.md](IDEAS.md) for product scope and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the design, remaining acceptance checks, and deferred Hidden Edge Add-ons publishing process.

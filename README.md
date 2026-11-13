# Open Source Portal Link

A small browser extension for opening a GitHub repository's Microsoft open source portal **Overview or JIT page**, and returning **from the portal to GitHub**.

**Version 0.3.0 reuses matching tabs in the same window.** Reload the extension after updating and review the new website-access request for GitHub and the Open Source Portal.

**Edge is verified; Safari development builds are ready for testing.** macOS Safari has the desktop menu/toolbar/shortcut; iPhone has an explicit destination popup. Safari runtime, Apple app packaging, and physical-device validation are not yet verified. See [Safari setup below](#safari-development-builds) and [SAFARI_IMPLEMENTATION_PLAN.md](SAFARI_IMPLEMENTATION_PLAN.md) for status.

```text
https://github.com/Azure-Samples/Durable-Task-Scheduler/issues/42
    ->
https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler
```

## Build and install in Edge

Requires Node.js 22+ (tested with 24.16.0), npm, and desktop Microsoft Edge 123+. Edge remains the only browser with recorded native runtime validation.

```sh
npm ci
npm test
```

`npm test` builds Edge and both Safari targets, then runs the automated tests. The loadable **Edge** extension is in **`dist/`**, not the project root. `npm run build` still builds only Edge.

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

## Safari development builds

```sh
npm run build:safari
npm run test:safari
```

| Target | Output | Permissions / interaction |
| --- | --- | --- |
| macOS | `build/safari/macos/` | `activeTab`, `contextMenus` and two-site URL access; same menus, direct toolbar action and Option+Shift+O as Edge |
| iPhone | `build/safari/ios/` | `activeTab` and two-site URL access; popup buttons for Overview/JIT on GitHub, or GitHub on the portal |

Use `build:safari:macos` or `build:safari:ios` to build just one target. No Xcode is needed to compile these extension resources. No Safari build overwrites Edge's `dist/`; generated outputs stay out of Git.

### Test locally in macOS Safari without Xcode

Recent Safari versions support [temporary folder installation](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension):

1. Run `npm run build:safari:macos`.
2. In Safari, open **Settings → Developer → Add Temporary Extension…**. If Developer is hidden, enable **Show features for web developers** under Advanced.
3. Select this project's **`build/safari/macos/`** folder. Handle Safari's developer-install authentication/approval prompts yourself.
4. Enable the temporary extension if necessary. Open the Azure-Samples repository above and try Overview, JIT, the toolbar, and Option+Shift+O. From the portal, try returning to GitHub. Review Safari's access prompts for **github.com** and **repos.opensource.microsoft.com**; background-tab reuse requires access to the destination site.
5. After rebuilding, use **Reload** in Safari's extension settings and review any changed site-access prompts. Repeat an action with a matching tab already open in the same window: it should switch to that tab without reloading it. Also test Overview versus JIT and an unsupported site/organization.

Temporary installations disappear when Safari quits or after 24 hours. If your Safari lacks **Add Temporary Extension**, use a containing macOS app built with Xcode instead. A suggested shortcut may conflict; inspect its assignment in Safari's extension settings where supported.

The user confirmed GitHub-to-portal tab reuse in local Safari **27.2**. Read-only inspection found the portal set to **Allow** but GitHub set to **Ask**, explaining why the reverse direction cannot inspect background GitHub tabs. Permissions were not changed; see Troubleshooting below. Full native acceptance remains incomplete, and a passing Node test does not establish Safari menu behavior, temporary grants, worker wake, or a supported minimum Safari version.

### iPhone and durable macOS app packaging

An iPhone cannot install the resource folder directly: it needs a containing iOS app. The packaging helper uses full Xcode's `safari-web-extension-packager` (or its older `converter` name), building the selected resources first:

```sh
npm run package:safari -- ios --bundle-identifier dev.yourteam.portal.ios
npm run package:safari -- macos --bundle-identifier dev.yourteam.portal.macos
```

Replace the example IDs with identifiers you are authorized to use. The helper creates separate platform projects under `apple/ios/` and `apple/macos/` so manifests cannot be mixed. It refuses to overwrite an existing project and does not sign, open Xcode, enroll accounts, upload, or publish anything. No native projects have been generated here: full Xcode is absent, and the helper's missing-tool failure was verified.

With Xcode installed, open the generated project, inspect its resource references, select an authorized signing team, and run the iOS app on a simulator, then a physical iPhone. The generated project references the platform's `build/safari/` resources rather than copying them. Rebuild those resources before each Xcode build; if adding/removing files later, review Xcode resource membership too. Inspect packaged resources before release. Set iPhone-only device-family/availability settings for the initial mobile scope.

Enable the installed extension in Safari's **More → Extensions** menu (or Safari extension settings). On a GitHub repository, select the extension and tap **Open Overview** or **Open JIT Access**; on the portal, tap **Open on GitHub**. Merely opening the popup does not navigate. If the source changes, closes, or loses URL access, reopen the extension from the source page. Buttons prevent duplicate taps and show failures inline.

Apple documents Developer Program membership for physical-device testing; simulator testing can precede enrollment. Local simulator/device deployment requires full Xcode. Apple's [App Store Connect web packager](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect) is an alternative without local Xcode for TestFlight/App Store distribution, not direct iPhone folder loading.

**Still required:** native macOS Safari and physical iPhone checks, real permission/popup lifetime tests, actual Xcode packaging/signing, and approved beta/store distribution. No Apple account or publishing actions have been taken.

## Desktop use

| Current page | Right-click action | Toolbar / Alt+Shift+O |
| --- | --- | --- |
| Supported GitHub repository | **Microsoft Open Source Portal → Open Overview** or **Open JIT Access** | Open Overview |
| Repository portal page, including `/jit` | **Open Repository on GitHub** | Open the GitHub repository root |

On macOS, the shortcut is **Option+Shift+O**. It works while the browser is focused. JIT is a right-click choice; the existing shortcut keeps its Overview default on GitHub.

Each action first looks for a matching destination tab **in the source window**. A match is activated without changing its URL, scroll position, query, or fragment; otherwise one new focused tab opens. The source stays open. Right-clicking a link to another repository still uses the **current page's repository**, not the link target.

- **GitHub:** reuse any page in the same repository, including an issue, pull request or file. Repository matching is case-insensitive.
- **Portal Overview:** reuse the repository root, including a trailing slash, query or fragment; never a JIT or another section.
- **Portal JIT:** reuse `/jit` or its nested pages; never Overview or another section.

Tabs in other windows or private contexts are not reused. Closed, moved, changed or unreadable candidates are skipped; if lookup/activation fails, a new tab is the fallback. If mobile Safari provides no usable source window ID, reuse is skipped rather than guessing another window. There is no background polling or remembered tab list.

For example:

```text
GitHub:   https://github.com/Azure/azure-functions-agents-runtime/issues/42
Overview: https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime
JIT:      https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime/jit
Return:   https://github.com/Azure/azure-functions-agents-runtime
```

GitHub subpages use the same Overview/JIT destinations. A newly created GitHub destination is the repository root; an existing matching GitHub subpage is preserved when reused. Source query strings and fragments are not copied into new destinations. Opening JIT only selects/opens the page: it does not request, approve, or grant access.

**Updating to 0.3.0:** click **Reload** on `edge://extensions` or in Safari's extension settings, then review the new GitHub/portal website-access request. Grant destination-site access for reuse to work; denied/unavailable lookup falls back to a new tab when the source remains eligible.

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

API permissions remain **`activeTab`** and **`contextMenus`** on desktop, and **`activeTab`** on iPhone. Version 0.3.0 also declares these exact HTTPS host permissions on all targets:

```json
["https://github.com/*", "https://repos.opensource.microsoft.com/*"]
```

These grant URL visibility for background destination tabs on those two sites so they can be found and activated. Browser access warnings can describe broader website-data capabilities; the shipped code only reads tab metadata on invocation and never injects code or reads page contents. Host access covers the two origins, not only the eight organizations; runtime validation still enforces the allowlist. There is no broad `tabs`/`<all_urls>` permission, content script, page modification, telemetry, credential handling, or runtime dependency.

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
| Existing tab is not reused | Check it is in the source window and matches the destination section, then allow extension access to its site; missing URL access falls back to a new tab |
| Safari reuses portal tabs but not GitHub tabs | In **Safari → Settings → Websites → Open Source Portal Link**, change **github.com** from **Ask** to **Allow**, then retry from the portal. Both listed sites need **Allow** for two-way background-tab lookup; no all-websites grant is needed. Invoking from GitHub can expose that source tab temporarily even while its setting is **Ask** |
| Changes are not reflected | Run `npm run build`, then Reload the extension on the browser's Extensions page |
| Build failed | Fix the error and rebuild before reloading; the build removes stale `dist/` output first |

Inspect the extension's service worker and Errors entry on the Extensions page for generic diagnostics. Your existing browser profile is not modified by the automated smoke tests.

## Development and verification

`src/repo-url.ts` is the pure mapper; `src/navigation.ts` handles fixed destinations, same-window candidate revalidation/activation and new-tab fallback. `src/service-worker.ts` and `src/safari/macos-background.ts` register `src/desktop-actions.ts`; iPhone imports its popup controller without desktop initialization. TypeScript emits native ES modules. PNG icons are included in `public/icons/`; regenerate them with `node scripts/generate-icons.mjs` if changing the original geometric design.

The `chrome.*` namespace and `@types/chrome` remain intentional; Safari also supports that namespace. `minimum_chrome_version` remains only in Edge's manifest. Chrome is not a supported product target.

```sh
npm test
```

For an optional native headless smoke test, pass the Edge executable:

```sh
npm run test:edge -- "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
```

`tests/edge-smoke.mjs` verifies it is running Microsoft Edge and uses Node's built-in WebSocket/CDP support with a temporary browser profile, which is deleted afterward. It serves local test HTML at controlled GitHub/portal/unsupported URLs and exercises shortcut navigation/reuse in both directions, the exact two-site permission set, all four menu registrations, feedback, worker restart, and source-window isolation. Destination tabs can load GitHub or the real portal; authenticated access is not tested. No browser binary is downloaded by the script.

**Verified:** strict builds for all three targets and 61 automated tests, including tab reuse, Overview/JIT separation, stale candidates, mobile cancellation/duplicate-tap/error/DOM behavior, and target resource/permission isolation. Native Edge **157.0.4341.57** checks pass for exact host permissions, reuse without URL changes/new tabs, GitHub subpage preservation, Overview/JIT separation and other-window exclusion. The user previously confirmed correct Edge menu placement and working navigation in both directions.

**Remaining checks:** exhaustive Edge context-menu visibility on selections/media/editable fields/frames and independently observed manual extension reload/update; all native Safari/device checks described above. No authenticated JIT access or Apple packaging/runtime pass is claimed.

See [IDEAS.md](IDEAS.md) for product scope and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the design, remaining acceptance checks, and deferred Hidden Edge Add-ons publishing process.

# Open Source Portal Extension: Implementation Plan

**Status:** version 0.3.0 implements approved same-window tab reuse with host access limited to GitHub and the Open Source Portal. Strict builds and all 61 automated tests pass; native Edge checks verify reuse and the two-origin permission budget. **Safari macOS/iPhone source and isolated builds are implemented**, but native Safari/device validation and Apple app packaging are not complete. See [SAFARI_IMPLEMENTATION_PLAN.md](SAFARI_IMPLEMENTATION_PLAN.md) for remaining gates.

Read [README.md](README.md) for installation and usage, or [IDEAS.md](IDEAS.md) for the product brief. This document distinguishes completed implementation from remaining acceptance checks and separately deferred publishing.

## Implementation status

| Work | Status | Completed result |
| --- | --- | --- |
| Design review before implementation | Done | Source-tab validation, permissions, module wiring, and API error handling reviewed before coding |
| `scaffold-extension` | Done | Strict TypeScript build, MV3 module manifest, original PNG icons, lockfile, and loadable `dist/` |
| `implement-url-mapping` | Done | Pure GitHub-to-Overview mapping with exact-origin and eight-organization validation |
| `wire-browser-actions` | Done | Context menu, toolbar/shortcut, focused source-window navigation, and best-effort per-tab feedback |
| `document-usage` | Done | Build, unpacked Edge installation, shortcuts, troubleshooting, and permission documentation in `README.md` |
| `extend-repository-routing` | Done | JIT destination and portal-to-GitHub root mapping with shared validation |
| `extend-navigation-actions` | Done | Overview/JIT submenu, reverse GitHub menu, and source-aware toolbar/shortcut defaults |
| `verify-bidirectional-navigation` | Done | 23 automated cases, native Edge checks, and user-confirmed menu placement and navigation in both directions |
| `document-expanded-navigation` | Done | README and product brief match the implemented Overview/JIT/reverse behavior |
| `narrow-edge-support` | Done | Edge metadata, installation guidance, and `test:edge` runner remain intact; Safari uses separate targets |
| `plan-safari-support` | Done | Original plan established desktop/mobile scope and gates; source implementation was authorized afterward |
| `safari-shared-navigation` | Done, source/tests | Shared navigator and explicit desktop registration; Edge behavior and permissions preserved |
| `safari-target-builds` | Done | Separate compiler entry points/manifests/resources outside `dist/`; exact target permissions and asset paths checked |
| `safari-macos-entry` | Source done; runtime unverified | Shared desktop handlers and Safari-specific MV3 manifest; real Safari menus/shortcut/grants/wake still need testing |
| `safari-iphone-popup` | Source done; runtime unverified | Accessible explicit destination popup, source-tab revalidation, inline errors and duplicate-tap prevention; no desktop API imports or background worker |
| Same-window repository tab reuse | Done; Safari native check pending | Source-window/private-context filtering, GitHub subpage preservation, separate Overview/JIT matching, stale-candidate revalidation and new-tab fallback; explicit approval for two-origin host access |
| `verify-extension` exhaustive manual matrix | Partial | Core checks above passed; remaining media/editable/frame contexts and independently observed manual reload/update are not recorded as passes |

### Remaining work, not implemented

| Work | Status | Boundary |
| --- | --- | --- |
| Remaining Edge manual acceptance matrix | Pending | Complete and record the outstanding contexts/reload checks before store-release readiness |
| Safari native compatibility/device validation | Blocked | macOS build can be tested locally without Xcode; no native extension install was performed. iPhone simulator/device tooling requires full Xcode, absent here |
| Safari containing apps | Partial / blocked | `package:safari` helper added, including safe missing-tool/overwrite checks; actual Apple project generation/signing/builds await full Xcode |
| `prepare-edge-release` | Deferred | Package script, release ZIP validation, listing assets, privacy policy, and publisher readiness require separate release authorization |
| `submit-edge-addons` | Deferred | Partner Center submission requires an authorized publisher and explicit final approval |
| `verify-edge-release` | Deferred | Verify the actual certified store installation after publication |

There is no store listing, automated `package:edge` script, or approved publishing action yet. The Edge release target remains a **Hidden Edge Add-ons** listing; official Microsoft-branded publishing is not required now. Safari packaging/distribution is planned separately, and Apple's visibility/publisher choices are not inherited from the Edge decision.

### Safari implementation and validation boundary

The user authorized implementing the Safari port after the earlier plan. Source, platform manifests/builds, popup UI, focused tests and a packaging helper are implemented. No Apple project, account change, signing, upload, or publication was performed. Native compatibility remains an explicit gate, not inferred from passing mocks.

| Platform | Planned interaction | Implementation status |
| --- | --- | --- |
| Safari on macOS | Overview/JIT submenu, reverse GitHub menu, direct toolbar action and desktop shortcut | Built in `build/safari/macos/`; awaiting local Safari checks |
| Safari on iPhone | Touch-friendly extension popup: Overview/JIT on GitHub, Open on GitHub on portal pages; no unsupported iOS context menus | Built in `build/safari/ios/`; awaiting containing app and simulator/physical-iPhone checks |

The existing mapper/allowlist and Edge build contract are preserved. Desktop behavior is in `desktop-actions.ts`, called explicitly by both desktop entries; iPhone imports no desktop initialization. All targets now share the approved same-window reuse behavior and exact two-origin host grants. Separate manifests/compiler entries prevent contamination. Real Safari grants, source-tab/window binding, worker behavior, popup lifetime and reuse still need native validation.

Safari 27.2 is installed locally, but only Command Line Tools are selected: full Xcode, the Safari packager/converter, and iPhone simulator are unavailable. Recent macOS Safari can load the generated folder temporarily without Xcode; [README instructions](README.md#test-locally-in-macos-safari-without-xcode) are ready for user testing. Chrome remains out of scope.

## Implemented goal

The Microsoft Edge extension opens the Microsoft open source management portal Overview or JIT page for the GitHub repository being viewed, and opens the GitHub repository from its portal page.

Example:

```text
https://github.com/Azure-Samples/Durable-Task-Scheduler
    ->
https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler
```

The same Overview/JIT destinations apply from that repository's issues, pull requests, files, branches, releases, settings, and other nested pages. Portal Overview, JIT, and other repository subpages return to `https://github.com/{org}/{repo}`.

## Repository-to-portal mapping examples

| GitHub repository URL | Portal overview URL |
| --- | --- |
| `https://github.com/Azure/azure-functions-agents-runtime` | `https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime` |
| `https://github.com/Azure-Samples/Durable-Task-Scheduler` | `https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler` |
| `https://github.com/microsoft/vscode` | `https://repos.opensource.microsoft.com/orgs/microsoft/repos/vscode` |
| `https://github.com/MicrosoftDocs/azure-docs` | `https://repos.opensource.microsoft.com/orgs/MicrosoftDocs/repos/azure-docs` |
| `https://github.com/dotnet/runtime` | `https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime` |

For example, `https://github.com/microsoft/vscode/issues/123` maps to the same overview URL as `https://github.com/microsoft/vscode`. Nested GitHub paths are never copied into the portal URL.

These examples demonstrate URL construction, not verified portal onboarding or access. Issue numbers and other nested paths are illustrative.

## Current state and authorization boundary

The repository URL mapper, Manifest V3 service worker, TypeScript build, original PNG icons, lockfile, automated tests, native Edge smoke test, and README are implemented. The loadable package is `dist/`.

The overview MVP was authorized after design review and confirmed working by the user. Version 0.2.0 added JIT/reverse navigation without changing permissions. The user subsequently authorized Safari source work and then same-window reuse, including URL access limited to GitHub and the portal. Version 0.3.0 supersedes the earlier no-host/no-reuse design; it does not authorize account registration, publication, automatic JIT requests, settings, or another shortcut.

### Review findings and implemented safeguards

The design review found no blocker to the agreed MVP. Implementation preserves exact-origin/current-page validation, callback error handling for menu creation, native ES-module wiring for Node and MV3, top-level event registration, and best-effort feedback that cannot block a valid open. Chromium 123+ is declared because the menu cleanup uses its promise API.

The managed npm proxy advertised cross-host tarballs that npm 12 rejected. Installing from the advertised Microsoft registry succeeded without relaxing remote-package restrictions or modifying user/global configuration. The lockfile omits registry download URLs so it does not pin consumers to that feed.

### Observed validation results

| Check | Result |
| --- | --- |
| Strict builds and `npm test` | Pass for Edge and both Safari targets; 61 automated cases |
| Managed-registry dependency restore | Previously verified clean; dependency versions unchanged |
| Native headless Edge 157.0.4341.57 | Pass for 0.3.0 |
| Native scope | Module loading, exact API/two-origin permissions, all four menus, shortcut navigation/reuse in both directions, preserved existing URLs/tab counts, Overview/JIT separation, other-window exclusion, unsupported sources, feedback, client-side navigation and stopped-worker wake |
| JIT destination | Exact `/jit` mapping and menu handler verified by automated tests; native menu click not exercised |
| Visible UI scope | User confirmed correct menu placement and working navigation in both directions; exhaustive selection/media/editable/frame visibility and independently observed manual reload/update remain outstanding |
| Authenticated portal/JIT access and store certification | Not tested; outside this implementation |

Native tests used isolated temporary profiles and local source-page fixtures, not the user's normal browser profile. Destination tabs could load GitHub or the real portal without an authenticated session. Automated checks did not modify the user's normal browser profile; UI-driven installation/reload was not performed. Outstanding visible-browser checks are not reported as passes.

## Confirmed current Edge decisions

| Area | Decision |
| --- | --- |
| Browser | Edge is natively verified; separate Safari macOS/iPhone development builds await native validation |
| Language | TypeScript with a build step |
| Initial installation | Load unpacked first; Edge Add-ons publishing is a documented post-MVP phase |
| Edge Add-ons visibility | Hidden, shared by installation link; submission remains deferred |
| Official Microsoft publishing | Deferred; Microsoft-branded publisher identity is not a current requirement |
| Entry points | Page context menu, keyboard shortcut, and toolbar button |
| Destination | Activate a matching tab in the source window without changing its URL, or open a new focused tab; source stays open |
| Context menus | GitHub: Overview/JIT submenu; portal repository pages: Open Repository on GitHub |
| Toolbar/shortcut default | GitHub → Overview; portal → GitHub repository root |
| Shortcut | `Alt+Shift+O`; `Option+Shift+O` on macOS |
| Repository context | Always use the current page's repository, not a clicked link |
| Organization matching | Only the eight organizations below, case-insensitively |
| Menu visibility | Coarse GitHub/portal document/frame filters; validate the top-level source URL and direction on invocation |
| Unsupported pages | Open nothing; show a `!` badge and explanatory toolbar tooltip |
| Permissions | `activeTab`, `contextMenus`, and exact HTTPS GitHub/portal host grants; no broad `tabs` permission |

Supported organizations, with canonical spelling for generated portal URLs:

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

## Scope and limitations

The MVP is a URL launcher, not a portal client. It does not check whether a repository exists, is public, is open source, or has been onboarded to the portal. It does not call GitHub or portal APIs, manage authentication, store credentials, retain browsing history, or collect telemetry. Reading the source URL and opening the requested destination are the intended data uses.

The portal handles its own sign-in, authorization, missing-repository, and network error pages. An eligible URL means the supported origin, repository-shaped path, and allowed organization. A nonexistent repository with that URL shape still produces a destination. URL-only validation cannot prove that every matching GitHub path is an actual repository; do not promise semantic existence checks.

Supported sources are `https://github.com/{org}/{repo}` and `https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}`, including nested pages. Both directions use the same eight organizations. GitHub Enterprise hosts, raw file hosts, gists, portal landing pages, arbitrary repository links on other websites, and additional organizations are outside scope.

**Two-origin execution boundary:** Overview/JIT actions require the exact top-level `https://github.com` origin and a supported repository path. The reverse action requires the exact `https://repos.opensource.microsoft.com` origin and `/orgs/{org}/repos/{repo}` route. Both enforce the eight-organization allowlist. Toolbar/shortcut select the direction from the source URL; explicit menu actions reject the opposite source site. Links or embedded frames cannot override the top-level source. Menu visibility is only a coarse document/frame filter, not this boundary.

URL validation enforces this boundary. `activeTab` is not hostname-scoped and can temporarily expose an unsupported source on invocation; the handler rejects it without reading contents, logging URLs, or navigating. Separately, version 0.3.0 has persistent-capability host grants for exactly GitHub and the portal, subject to browser/user access settings, to inspect matching destination-tab URLs on demand. These grants cover those origins, not only allowed organizations; runtime validation remains essential.

The Edge target has no popup, options page, injected GitHub UI, content script, backend, persistent storage, analytics or global operating-system shortcut. On-demand tab reuse is implemented; there is no stored tab index or background URL polling. The iPhone popup is platform-specific navigation UI, not an injected webpage interface.

## Implemented navigation: Overview, JIT, and GitHub

JIT began as a future idea. After confirming the overview MVP works, the user explicitly requested JIT and proposed reverse portal-to-GitHub navigation. Both are now implemented in version 0.2.0.

The supplied portal examples establish that Overview uses the repository root, while the JIT page adds `/jit`:

```text
GitHub:
https://github.com/Azure/azure-functions-agents-runtime

Overview:
https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime

JIT:
https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime/jit
```

Destination patterns:

| Destination | Pattern | Scope |
| --- | --- | --- |
| Overview | `https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}` | GitHub context menu and toolbar/shortcut default |
| JIT | `https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}/jit` | Explicit GitHub context submenu choice |
| GitHub | `https://github.com/{org}/{repo}` | Portal context menu and toolbar/shortcut default |

Overview has no `/overview` suffix; JIT appends exactly `/jit`. A newly constructed reverse destination is the GitHub root without portal subpaths/query/fragment. Reuse instead preserves an existing GitHub repository page intact. The route examples came from the user; authenticated cross-repository behavior has not been independently verified.

### Features to evaluate later

- **Separate JIT shortcut:** preserve the existing Overview shortcut and optionally add a user-configurable `open-jit` command. Unlike `_execute_action`, this custom command would use `commands.onCommand`.
- **Preferred toolbar destination:** optionally let users choose Overview or JIT for toolbar activation. This requires a settings experience and likely `storage`; it is not part of the current permission budget. Revisit keyboard behavior too, because `_execute_action` shares the toolbar action.
- **Copy either portal link:** offer Overview/JIT link copying for sharing without opening a new tab, after reviewing clipboard requirements.

The implemented context menu makes the destination explicit after shared organization/repository validation. Destinations are constrained to Overview, JIT, and the GitHub repository root; no arbitrary URL or suffix is accepted. No broader host access was added.

Direct JIT navigation means **opening the portal's JIT page only**. It must not automatically request, approve, or grant access. Authentication, eligibility, and any privileged action remain in the portal.

Automated tests prove that Overview has no suffix, JIT appends exactly `/jit`, reverse navigation opens the GitHub root, unsupported sources are rejected, and an eligible link/frame cannot bypass top-level validation. Real JIT access and native submenu interaction remain explicit acceptance limits, not claimed passes.

## Implemented architecture

The implemented Edge extension uses Chromium `chrome.*` APIs, `@types/chrome`, and the manifest's `minimum_chrome_version`. The namespace is supported by Safari too; Safari manifests omit Chromium-only metadata. TypeScript compiles to native JavaScript ES modules using `tsc`; there is no framework or bundler.

### Project layout

```text
IDEAS.md
IMPLEMENTATION_PLAN.md
SAFARI_IMPLEMENTATION_PLAN.md
README.md
package.json
package-lock.json
tsconfig.json
tsconfig.safari-macos.json
tsconfig.safari-ios.json
.gitignore
src/
  repo-url.ts
  navigation.ts
  desktop-actions.ts
  service-worker.ts
  safari/
    macos-background.ts
    popup-controller.ts
    ios-popup.ts
    theme.ts
public/
  manifest.json
  icons/
    icon16.png
    icon32.png
    icon48.png
    icon128.png
scripts/
  clean.mjs
  copy-assets.mjs
  generate-icons.mjs
  build-safari.mjs
  package-safari.mjs
safari/
  macos/manifest.json
  ios/manifest.json
  ios/popup.html
  ios/popup.css
tests/
  edge-smoke.mjs
  repo-url.test.mjs
  service-worker.test.mjs
  navigation.test.mjs
  safari-*.test.mjs
  helpers/desktop-tests.mjs
dist/                         generated Edge resources
build/safari/macos/            generated desktop Safari resources
build/safari/ios/              generated iPhone Safari resources
```

`dist/` contains the manifest, compiled modules, and icons only. Keep tests, source TypeScript, and development dependencies outside the loadable extension.

### Edge manifest and module contract

| Setting | Required design |
| --- | --- |
| Manifest version | `manifest_version: 3` |
| Background | `service_worker: "service-worker.js"` and `type: "module"` inside `background` |
| Toolbar | `action` with a title and icons; no `default_popup` |
| Shortcut | `_execute_action`, with `Alt+Shift+O` as the default and macOS binding; macOS displays Alt as Option |
| Permissions | `activeTab`, `contextMenus`; `host_permissions` limited to the two exact HTTPS origins |
| Assets | Manifest-relative PNG paths that exist in `dist/` |
| Node module mode | Root `package.json` uses `"type": "module"` so `.mjs` tests can import emitted `.js` ES modules consistently |

This contract is necessary for the compiler-only approach: both the extension service worker and the Node test runner must interpret the emitted files as ES modules.

### Completed build and development tooling

- `typescript` and `@types/chrome` are pinned development dependencies; there are no runtime dependencies.
- Node.js 22+ is required; development was verified with 24.16.0 and is documented in `README.md`.
- Strict TypeScript checks and `noEmitOnError` are enabled; `rootDir` is `src` and `outDir` is `dist`.
- `module` and `moduleResolution` use `NodeNext`; the target is `ES2022`. Explicit `.js` import paths work in both the Edge worker and Node test runner; production modules use no Node-only runtime APIs.
- `scripts/copy-assets.mjs` copies the manifest and original PNG icons into `dist/` after compilation succeeds.
- Node's built-in test runner and assertions run `.mjs` tests against the compiled production modules.
- `npm run build` cleans generated output, compiles, and copies assets. Failed builds do not leave a stale loadable package.
- `npm test` builds all targets and runs 61 focused cases, including original mapper/desktop checks and reuse/race/boundary tests. `npm run test:safari` builds Safari and runs its focused tests.
- `npm run test:edge -- "<Edge executable>"` builds and runs `tests/edge-smoke.mjs` in an isolated profile. The runner verifies the browser is Microsoft Edge.
- The lockfile pins dependency versions and integrity without registry-specific download URLs. Dependencies, generated Edge/Safari outputs, packaged extensions and local Apple build/signing artifacts are ignored.
- There is no separate linter or formatter configuration; no extra tooling stack was added.

### URL mapping: `src/repo-url.ts`

Keep parsing and destination construction pure and independent of browser APIs.

1. Parse the input with the standard `URL` API.
2. Require the exact HTTPS GitHub origin for Overview/JIT, or the exact HTTPS portal origin for reverse navigation; reject credentials, lookalike domains, unsupported schemes, and missing URLs.
3. Extract the first two GitHub path segments, or require the portal's literal `/orgs/{org}/repos/{repo}` route and extract its organization/repository. Do not shift segments by silently dropping empty components.
4. Decode those two segments safely, rejecting malformed encoding, embedded separators, empty names, and invalid repository-name characters. Decode only once; never let encoded slashes or backslashes introduce extra path components.
5. Match the organization against the fixed allowlist, case-insensitively, and use its canonical spelling in the destination.
6. Preserve repository-name spelling and case. Support normal GitHub repository characters, including dots, underscores, and hyphens; `.github` is a valid example. Do not lowercase repository names or strip suffixes such as `.git`.
7. Ignore all later path components, query parameters, and fragments.
8. Encode organization and repository as individual destination path segments. `toPortalUrl(input, "overview" | "jit")` defaults to Overview and appends exactly `/jit` when selected. `toGitHubUrl(input)` accepts portal repository routes and returns the GitHub root. Both return `null` for unsupported inputs.

Do not derive the repository from a selected link, selected text, image source, iframe URL, or GitHub page DOM. Do not invent a repository from an organization landing page.

### Desktop integration: `src/desktop-actions.ts`

Both desktop entry modules synchronously call `registerDesktopActions()` while loading, so listeners are available after service-worker restart. Keep one shared navigator for validation/opening, with desktop-specific feedback. Importing the navigator or popup must not register desktop listeners.

**Context menu**

- Register a GitHub parent `Microsoft Open Source Portal` (`open-source-portal`) with `Open Overview` (`open-source-overview`) and `Open JIT Access` (`open-source-jit`) children, plus a portal-only `Open Repository on GitHub` (`open-github`) item.
- Create or replace it idempotently during `runtime.onInstalled`, covering installation and extension updates without duplicate entries.
- Use the `contextMenus.create` completion callback to check `runtime.lastError`; do not assume `create` is a promise-returning API. Register click listeners separately at module top level.
- Use `documentUrlPatterns: ["https://github.com/*/*"]` for all GitHub submenu entries and `["https://repos.opensource.microsoft.com/orgs/*/repos/*"]` for the reverse item.
- Include page, selection, link, editable, image, audio, video, and frame contexts. Do not filter by the clicked link's target.
- On `contextMenus.onClicked`, map the recognized leaf ID to its destination, then use the source tab's top-level `tab.url`, not `linkUrl` or `frameUrl`. Parent/unknown IDs do nothing. Reject actions on the wrong source site.
- If the source URL is unavailable, fail safely rather than guessing another repository or another tab.

The coarse menu filters are not authorization or repository validation. They can match unsupported organizations or routes. The shared URL mapper makes the final decision when invoked.

`documentUrlPatterns` matches documents or frames. A matching frame inside another site can affect menu visibility, and a nonmatching embedded frame may not show the item. Do not promise "visible everywhere in every repo and nowhere else" using this API alone. Normal top-level page/selection/link/editable/media contexts are the target; arbitrary embedded-frame visibility is not guaranteed. The top-level source URL and direction still gate every opening.

**Toolbar and keyboard**

- Declare an `action` with a title and icons, but no popup.
- Handle toolbar clicks through `action.onClicked`.
- On GitHub, keep opening Overview. On portal repository pages, open the GitHub root. No popup, preference, or separate JIT shortcut is added.
- Bind the reserved `_execute_action` command to `Alt+Shift+O`, with the equivalent macOS shortcut.
- The reserved command triggers the same action handler; it does not dispatch `commands.onCommand`. No separate keyboard handler is needed.
- Document remapping through `edge://extensions/shortcuts`. Suggested shortcuts are not guaranteed to register if another shortcut conflicts.

**Opening and feedback**

- On a valid invocation, query the destination origin in the source window. Validate candidate URL, repository, window/private context and absence of a different pending URL; re-read each eligible candidate before activating it with `tabs.update(id, { active: true })`. Never pass a new URL when reusing.
- GitHub matches any page in the same repository case-insensitively. Overview matches the portal repository root; JIT matches `/jit` and nested JIT pages, never Overview or another section. Ignore query/fragment for matching, but preserve them on reused pages.
- Skip closed, moved, changed or unreadable candidates. If no activation succeeds or lookup is denied/fails, create the computed destination with `active: true` in the source window. Do not search other windows or cross private contexts. On mobile without a usable window ID, skip reuse; popup dismissal cancels pending lookup before activation/creation.
- Clear previous per-tab error feedback on the next invocation; restore the normal title after a successful operation.
- Treat badge/title updates as best-effort UI. Their failure must not prevent URL validation or a valid tab-opening attempt; do not add background URL monitoring solely to refresh feedback.
- Unsupported inputs must not create a tab. Use a per-tab `!` badge and `Open a supported GitHub repository or its Open Source Portal page.`
- Catch tab-creation and other browser API failures. Avoid unhandled promise rejections and unchecked `runtime.lastError` values, including if the source tab closes.
- If no usable source tab ID/window ID exists, return safely rather than falling back to an unrelated active tab/window. Log only generic diagnostics, not raw source URLs or potentially sensitive browser error text, and never apply an error badge globally.
- Badge feedback is easiest to see when the extension is pinned; make pinning part of the installation instructions.

### Permissions

Desktop API permissions remain:

```json
["activeTab", "contextMenus"]
```

All target manifests additionally declare the user-approved host access:

```json
["https://github.com/*", "https://repos.opensource.microsoft.com/*"]
```

The host grants expose background destination-tab URLs so they can be found/revalidated without the broad `tabs` permission. `activeTab` remains for explicit source gestures; iPhone omits `contextMenus`. Actual website access can be denied/revoked by the user, in which case lookup falls back safely. Browser warnings may describe read/change website-data capabilities, but the code reads tab metadata only on invocation.

Do not add `<all_urls>`, `tabs`, `scripting`, `storage`, `notifications`, clipboard access, or more origins. Context-menu URL patterns remain visibility filters, not permissions.

### Reference: Learn extension permissions

Read-only inspection of the installed **Microsoft Learn Content Metrics 3.2.1** extension at `edge://extensions/?id=ecgmpjcohidknecgamipmidhndgmbajb` showed:

| Edge Details field | Observed value |
| --- | --- |
| Permission warnings | `Read your browsing history`; `Display notifications` |
| Automatically allowed site access | `*://dev.learn.microsoft.com/*`, `*://learn.microsoft.com/*`, `*://prdev.learn.microsoft.com/*`, `https://localhost:44329/*` |
| Site access capability | Read and change data on the listed sites |

These are the browser's displayed warnings and access settings, not an inspection of the extension's raw manifest. In particular, do not infer an exact API permission identifier from a warning label alone.

The separate `edge://settings/privacy/sitePermissions/...` page supplied by the user shows content settings for the extension's own `chrome-extension://` origin, including browser defaults. Its Location, Camera, Clipboard, and other entries are not proof that the extension requested all those permissions. No permissions or settings were changed during inspection.

The Learn tool is a comparison, not a permission template. Our launcher needs none of its Learn/localhost grants or notifications. The approved reuse feature adds only the GitHub/portal host grants described above; navigation-only JIT itself requires no additional permissions.

## Completed verification and remaining acceptance checks

### Automated checks: complete

`npm test` is the smallest complete build-and-test command. The implemented URL mapper tests cover this matrix:

| Input or case | Expected result |
| --- | --- |
| The five repository roots in the mapping table | Their exact listed overview URLs |
| Eligible root with trailing `/`, nested issue/PR/file/branch/actions/release/settings paths, query, or fragment | Same overview as the root; no source query/fragment in the destination |
| All eight organizations, including mixed-case input | Accept; use canonical organization spelling |
| Repository names such as `Sample_repo.v1` and `.github` | Preserve case and punctuation |
| A syntactically valid but nonexistent repository in an allowed organization | Construct a URL; do not perform an existence check |
| GitHub home, organization-only URLs, `/orgs/Azure/repositories`, or `/settings/profile` | Reject because required segments or allowed owner are absent |
| Unsupported organization, `http://github.com`, non-default port, credentials, other host, or `github.com.example.com` | Reject |
| Missing/malformed URL or empty owner/repo; malformed percent encoding or an encoded slash/backslash in either extracted segment | Reject without throwing |
| Valid GitHub repository with JIT selected | Overview URL plus exactly `/jit`; discard GitHub nested path/query/fragment |
| Valid portal Overview, JIT, or nested repository page | Canonical GitHub repository root; preserve repository spelling |
| Portal root, incomplete/wrong route, unsupported organization, unsafe encoding, lookalike host, or credentials | Reject reverse navigation |

The worker tests stub only the required browser API surface and cover:

- Context-menu/action handlers create one focused tab when no match exists, or activate a matching source-window tab without updating its URL. Unrelated menu IDs do nothing.
- Shared navigator tests cover case-insensitive repository matching, Overview/JIT section separation, candidate closure/change/move, private/window isolation, denied lookup, activation failure and popup cancellation.
- Overview/JIT menu actions reject portal sources; reverse menu rejects GitHub sources. Toolbar/shortcut choose the direction from the validated source.
- A clicked link or iframe URL cannot override the top-level source URL, including when an eligible GitHub/portal link or frame appears on an unrelated website.
- Ineligible source URLs create no tab and produce per-tab feedback when a usable tab ID is available; missing source context never falls back to another tab.
- Repeated menu setup does not duplicate entries; menu creation and tab creation errors are handled.
- Previous feedback can be cleared, and a badge/title API failure does not block an otherwise valid open.

Automated mocks cannot prove real browser permission grants, context-menu visibility, or shortcut dispatch. Those need the browser checks below.

### Edge acceptance matrix: core behavior confirmed; exhaustive checks remaining

The native smoke runner covers real permissions, shortcut dispatch, stopped-worker wake, navigation changes, and source-window behavior. The user confirmed that the menus appear in the right places and work in both directions. The list below remains the complete release checklist; it is not a claim that every visible interaction has been independently exercised.

1. Build, enable Developer mode, and load `dist/` unpacked. Confirm the manifest and service worker load without errors.
2. Pin the extension. Without matching destination tabs, test both Overview/JIT menus, toolbar and shortcut from GitHub, and reverse actions from portal Overview/JIT. Each creates the exact destination in one focused source-window tab. Repeat with matching tabs: activate without navigation/duplication; preserve GitHub subpages and keep Overview/JIT separate.
3. Repeat from representative nested repository pages and after GitHub's client-side navigation. Confirm the URL is read at invocation, not cached from an earlier repository.
4. Right-click page whitespace, selected text, a normal link, an image, and an editable field where the native browser context menu is available.
5. Right-click a link to a different repository. Confirm the destination still corresponds to the current page.
6. Try unsupported organizations on both sites, portal landing pages, and a normal unrelated website without matching embedded frames. No destination should open; feedback should explain unsupported input, and menus should be absent on the unrelated document. Embedded frames must not override top-level validation; record unexercised frame behavior rather than claiming perfect visibility.
7. Verify shortcut assignment and remapping in Edge; use a different combination if the suggested shortcut conflicts locally.
8. Let the service worker stop, then invoke again. Reload/update the extension and confirm the menu is not duplicated.
9. With two windows open, ensure a match only in the other window is ignored; reuse/create stays in the source window and private context.
10. Inspect extension errors and the exact two-origin host/API permission budget. Test denied destination-site access and missing URL visibility; lookup should fall back to creation, never a guessed tab. No unexpected network requests or background polling.

Portal sign-in or authorization failures are not URL-routing failures. Verify the constructed URL separately from authenticated portal access, which may require the user's account. If browser installation or account access is unavailable, record that limitation rather than claiming that end-to-end access was verified.

### MVP completion gate

The Edge implementation and core functional validation are complete as recorded above. Full Edge release readiness still requires recording the remaining manual matrix, validating the release package, and meeting store requirements. Safari source is implemented but has separate native/device/package gates; it neither blocks the Edge release nor inherits Edge runtime results. A blocked or unrecorded check is not a pass.

Correct JIT destination construction and reverse navigation are required and covered by tests. Authenticated portal/JIT access and store certification are separate concerns and are not claimed as validated.

## User documentation: complete

`README.md` documents:

- Initial dependency installation, `npm test`, and `npm run build`.
- Loading `dist/` through `edge://extensions`.
- Pinning, all three entry points, and the eight supported organizations.
- Shortcut conflicts and remapping.
- Rebuilding and reloading after source changes.
- The accepted menu-visibility tradeoff, unsupported-page feedback, portal authentication, and lack of repository-existence checks.
- Why desktop API permissions are `activeTab`/`contextMenus`, iPhone omits menus, and the two host grants are needed to inspect background destination URLs.

The store installation link and actual store-update verification are not available yet. They will be added only after the separately approved Edge release.

## Publishing to Microsoft Edge Add-ons

This is the **deferred Edge release plan**, not authorization to register an account, accept agreements, upload a package, or publish a listing now. It applies only to Microsoft Edge; the separate Safari plan covers proposed Apple packaging and distribution.

### Why a site-specific extension can be published

The [Microsoft Learn Content Metrics listing supplied by the user](https://microsoftedge.microsoft.com/addons/detail/microsoft-learn-content-m/ecgmpjcohidknecgamipmidhndgmbajb) is a useful product example: its described purpose is specific to Microsoft Learn pages, yet it is distributed through Edge Add-ons.

Store distribution does not require an extension to work on every website. Edge's developer policies call for a narrow, single purpose. For this extension, that purpose is navigation between a supported GitHub repository and its management portal Overview/JIT pages. The listing must explain the eight-organization scope, unsupported-page behavior, and the portal's account/access requirements.

The example is not evidence that this project will pass certification or may use the same publisher identity. Do not copy its branding, product images, description, or privacy disclosures.

### Chosen visibility and deferred publisher decisions

The user selected **Hidden** for the planned Edge Add-ons listing. Share its installation URL directly rather than making it discoverable through store search.

An official Microsoft-branded release is **deferred**, not a current requirement or a prerequisite for the MVP. There is no need to identify an internal Microsoft publishing team or pursue corporate publisher approvals now.

When a hidden release is separately approved, use an authorized Edge developer account and follow the linked registration guide if enrollment is needed. The visible publisher name will be that account's registered identity; do not imply Microsoft affiliation without authorization. Account creation, publisher selection, and any later Microsoft-branded release remain future decisions.

| Visibility | What it means | Fit for this project |
| --- | --- | --- |
| Hidden | Not discoverable through search or browsing; distributed by sharing the listing URL | Chosen for the planned release |
| Public | Discoverable through store search, browsing, and its listing URL | Not selected; reconsider only if broad discovery is wanted later |

Hidden is **not** tenant-restricted, employee-only, or an authorization boundary: someone with the URL can reach the listing. Portal authentication and authorization remain necessary. Hidden submissions still undergo certification and must meet production-quality requirements; they are not a way to publish an experimental or internal-testing-only build.

If actual organization-restricted installation is required, ask the organization's browser administrators about managed enterprise distribution as a separate deployment design. Do not represent a hidden store listing as a private enterprise catalog.

### Release steps

1. **Finish and verify the extension.** Complete the MVP implementation, browser acceptance checks, and user documentation. Confirm the release is stable and has no placeholder features. Publishing is not a substitute for the unpacked testing stage.
2. **Prepare the tested ZIP.** Run `npm ci` and `npm test`, then package the tested contents of `dist/` into a versioned ZIP. `manifest.json` must be at the archive root beside the compiled JavaScript and icons, not nested under `dist/`. Exclude `src/`, tests, dependencies, session files, credentials, and unrelated documents. Inspect the archive and load its extracted contents in Edge before upload. A future `npm run package:edge` script can make this reproducible; it does not exist yet.
3. **Prepare the store materials.** Finalize the manifest name, description, and numeric version; an Edge-specific listing description; an original square logo; a support contact/URL; a hosted privacy policy; and certification notes. The current guide requires a listing description of 250-10,000 characters and a square logo of at least 128 x 128 pixels, recommending 300 x 300. Screenshots are optional but useful: show the repository context menu and toolbar behavior using public, non-sensitive examples. Describe JIT as navigation only, not automatic access, and do not reference competing browsers in Edge store metadata.
4. **Create the submission in Partner Center.** An authorized owner opens the Edge workspace, selects **Create new extension**, uploads the ZIP, and resolves package validation issues. Set visibility to **Hidden** and select the intended markets. Fill in Properties, using an appropriate category such as Productivity, and provide support information.
5. **Complete Privacy and Store listings.** State the single purpose, justify each permission, declare no remote code, and accurately disclose data handling. Fill in the required listing details for each included language and supply the accessible privacy policy URL. Keep the disclosures consistent with the shipped implementation, not just the intended design.
6. **Provide certification instructions and explicitly approve submission.** Explain how to exercise each entry point on the Azure-Samples example and an unsupported page, including shortcut assignment. Describe the expected portal URL and any sign-in/access restrictions. Where restricted access prevents full review, coordinate with the authorized publisher and portal owner on an approved testing approach or a clear explanation in the certification notes; never put employee credentials or production secrets into source files, screenshots, public listing text, or this plan. A sign-in page alone does not guarantee certification. The release owner reviews the final package and listing before selecting **Publish**.
7. **Verify the approved store release.** After certification and the **In the Store** status, install from the real listing in a clean Edge profile, not just from the unpacked build. Verify the publisher, version, permissions, all three triggers, supported/unsupported behavior, and any documented access requirements. Record the assigned extension ID and listing URL, then add the store installation link to `README.md`. Store users should not need Developer mode or local Node tooling.

Hidden visibility is confirmed; publisher selection and actual submission are deferred. Store approval remains subject to Microsoft's review.

### Proposed privacy and permission disclosures

| Field | Intended disclosure to verify against the finished extension |
| --- | --- |
| Single purpose | Navigate between a supported GitHub repository and its Microsoft open source management portal Overview/JIT pages |
| `activeTab` | Read the current tab's URL only when the user explicitly invokes the context menu, toolbar action, or shortcut |
| `contextMenus` | Add Overview/JIT choices on GitHub and a reverse GitHub action on repository portal pages |
| GitHub/portal host permissions | Inspect matching destination-tab URLs on these two exact HTTPS origins only, on invocation, to activate an existing same-window tab |
| Remote code | None; all extension JavaScript is included in the uploaded package |
| Data handling | Process source and same-window destination-tab URLs locally; no retained history, tab index, analytics, page contents, or credentials |
| Navigation disclosure | Opening the requested GitHub or portal page sends the organization/repository in the destination URL to that site, which manages its own session and data handling |

Provide a product-specific privacy policy that accurately covers URL access and user-requested navigation even though the extension has no telemetry backend. Do not claim that it accesses no user data or makes no network navigation. Do not automatically copy Microsoft's privacy statement: Edge policy limits its use to official Microsoft extensions. Publisher/legal owners must approve the actual policy and Partner Center data-use answers.

### Release artifacts and ongoing updates

During the separately approved release phase, add `store/edge/listing.md`, `store/edge/review-notes.md`, and listing artwork, plus a privacy-policy document published at an accessible approved URL. Keep these out of the extension ZIP. Keep credentials and internal-only approval details out of public release materials.

For updates, increment the manifest version, rebuild and verify, upload the replacement ZIP to the **existing** Partner Center extension, and submit it for certification. Do not create a new listing for each version. Store-installed copies receive approved updates through the store; unpacked copies still require rebuilding/reloading. Record release notes and re-review disclosures if permissions or functionality change, including future settings or shortcut changes.

If a release needs correction, ship a fixed package with a higher version. Unpublishing stops new acquisition but does not remove copies already installed. Any publishing automation is future work after the manual release path is established.

### Post-MVP release todos

| ID | Status | Todo | Prerequisites | Completion condition |
| --- | --- | --- | --- | --- |
| `prepare-edge-release` | Deferred | Prepare the versioned ZIP, listing assets, privacy policy, reviewer guidance, and authorized publisher readiness for a Hidden listing | Remaining Edge matrix, `document-usage`, separate release authorization | Extracted package works; assets and disclosures match behavior; an authorized publisher is ready without requiring Microsoft-branded publication |
| `submit-edge-addons` | Deferred | Submit through the authorized Partner Center account | `prepare-edge-release`, explicit final submission approval | Submission is accepted for certification; any review feedback is addressed |
| `verify-edge-release` | Deferred | Verify the certified store installation and document its URL and update process | `submit-edge-addons`, successful certification | Store-installed behavior passes; correct publisher/version and listing link are recorded |

These are deferred release tasks. Adding them to the plan does not authorize publication or change the implemented navigation-only scope.

## Evidence and outstanding verification

| Basis | What it establishes | What it does not establish |
| --- | --- | --- |
| Confirmed product choices | Eight organizations, current-page behavior, three entry points, Overview/JIT and reverse navigation, TypeScript, minimal permissions, Hidden later distribution | Runtime behavior by themselves |
| User-supplied portal examples | Intended overview root and an example `/jit` URL | Cross-repository route behavior, access rights, or onboarding |
| Official browser documentation linked below | API contracts, permission model, and store submission process | Runtime behavior by itself |
| Learn extension UI observation | Displayed warnings and site access for the inspected installed version | Its raw manifest, internal design, or permissions needed by this project |
| Implemented automated and native headless tests | The results listed under Observed validation results | Visible native UI behavior, authenticated portal access, or store approval |

There are no intentionally unresolved Edge MVP product choices. The user confirmed working menu placement and navigation in both directions. The remaining exhaustive UI checks are listed above and in `README.md`; this is not a claim that the full acceptance matrix passed. Publisher account, release materials, and certification arrangements remain later release decisions.

## Design review: complete

Sol reviewed the original Edge design before implementation, including its initial two-permission model. Version 0.3.0's later user-approved two-origin host access/reuse supersedes the original no-host/no-reuse constraint and has focused/native Edge tests. The original review is not a Safari compatibility or new-permission review. Automatic JIT access, settings, and publishing remain outside the implemented scope.

## References

These Chromium API references describe the extension APIs used by Microsoft Edge; they do not add another supported browser.

- [Chromium activeTab permission and user gestures](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chromium context menus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)
- [Chromium commands and reserved action commands](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [Chromium toolbar actions, badges, and titles](https://developer.chrome.com/docs/extensions/reference/api/action)
- [Chromium Tabs API permissions](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [MDN: tab queries and host-permission URL visibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/query)
- [Chromium URL match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
- [Microsoft Edge unpacked extension setup](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)
- [Register as a Microsoft Edge extension developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)
- [Publish a Microsoft Edge extension: packaging, visibility, privacy, listings, and certification](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Microsoft Edge Add-ons developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)
- [Update or remove a published Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension)
- [Microsoft Learn Content Metrics: user-supplied product example](https://microsoftedge.microsoft.com/addons/detail/microsoft-learn-content-m/ecgmpjcohidknecgamipmidhndgmbajb)

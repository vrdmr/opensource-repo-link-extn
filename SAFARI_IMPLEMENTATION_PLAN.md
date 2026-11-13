# Safari Implementation Plan: macOS and iPhone

**Status: Safari source and isolated development builds implemented; native validation incomplete.** Version 0.3.0 adds user-approved same-window tab reuse and host access limited to GitHub/the portal across all targets. No Apple account changes, native project generation, signing, uploads, or publication were performed.

The [main implementation plan](IMPLEMENTATION_PLAN.md#implementation-status) indexes completed work. The design below is the implementation contract; the [status table](#implementation-sequence-and-dependencies) distinguishes source completion from remaining native gates. Apple/MDN documentation and passing Node tests are not evidence that this extension runs correctly in Safari.

## Current results and blockers

- `npm test` passes all three strict builds and 61 automated cases, including repository/section matching, candidate revalidation, private/window boundaries, fallback and popup cancellation.
- Native Edge 157.0.4341.57 checks verify exact two-origin permissions and actual shortcut reuse without URL changes or duplicate tabs. Safari runtime results are not inferred from Edge.
- macOS output is `build/safari/macos/`; recent Safari can temporarily load this folder without Xcode. [Local instructions](README.md#test-locally-in-macos-safari-without-xcode) are ready for user testing.
- iPhone output is `build/safari/ios/`; it has a local popup, no worker, `activeTab` and the same two host grants as desktop.
- The user confirmed GitHub-to-portal reuse in Safari 27.2 but reported reverse reuse failing. Read-only native settings inspection found `github.com = Ask` and `repos.opensource.microsoft.com = Allow`; reverse lookup requires the user's GitHub grant. No permission was changed, and reverse native verification remains pending.
- The selected developer directory is `/Library/Developer/CommandLineTools`; full Xcode, both Safari packager names, and iPhone simulator tooling are unavailable.
- `package:safari` can generate separate native projects when Xcode is available. Its missing-tool failure is verified, but successful Apple packaging, app builds, simulator/physical-iPhone behavior, and exact support floors remain blocked/unverified.

## Goal and scope

Reuse the current TypeScript URL mapper, eight-organization allowlist, and Overview/JIT/GitHub destinations. Add small platform-specific entry points, isolated build outputs, and Apple packaging rather than rewriting the extension.

| Target | Planned experience | Status |
| --- | --- | --- |
| Microsoft Edge desktop | Existing menus, direct toolbar action, and shortcut stay unchanged | Implemented; regression gate |
| Safari on macOS | Overview/JIT context submenu, reverse GitHub menu, direct toolbar action, and desktop shortcut | Source/built resources ready; native validation pending |
| Safari on iPhone | Open the extension from Safari's page/More menu, then choose a destination in a touch-friendly popup | Source/built resources ready; app/device validation blocked |

Both Safari targets derive the destination from the top-level source, never a clicked link, selected text, frame or cached repository. Preserve repository spelling/canonical organization output and reject unsupported origins/routes/organizations. Activate an existing matching destination in the source window without changing its URL, otherwise create a new tab; source stays open.

GitHub reuse accepts any page in the same repository case-insensitively. Portal Overview matches the root (optional trailing slash/query/fragment); JIT matches `/jit` and nested JIT pages, never Overview or another section. Query only the target origin/window, exclude other private contexts, and re-read candidate URL/window/context/pending navigation before activation. Failed/denied lookup or stale candidates fall back to creation. If mobile Safari exposes no usable source window ID, skip reuse rather than guessing another window.

JIT remains navigation to `/jit` only. No automatic access requests, approvals, credentials, portal APIs, repository-existence checks, telemetry, or GitHub/portal page injection.

**Initial scope defaults:** retain the current desktop interaction; add a popup only for iPhone; target current stable macOS Safari and iOS Safari first. Record exact Safari, macOS, iOS, Xcode, and deployment-minimum versions during the compatibility phase before promising a supported version range. Older releases require additional testing rather than an assumption based on MV3 support.

Chrome support is not restored. iPad-specific UX, visionOS, Safari web apps, embedded in-app browsers, Share Sheet integration, external-keyboard shortcuts on iPhone, settings, and configurable organizations are not initial targets. Configure Apple device-family/availability settings accordingly; do not claim these platforms merely because a generated app can run there.

## Verified platform facts and remaining questions

| Documented fact | Consequence for this project |
| --- | --- |
| Safari supports `chrome.*` and `browser.*`, callbacks and promises; MV3 support exists from Safari 15.4 [1] | Keep the current namespace and compiler-first approach unless a tested API difference requires a small adapter. This does not establish a minimum supported Safari version |
| `contextMenus` / `menus` are unsupported on iOS [1] | Do not include or register desktop context menus in the iPhone target |
| Safari prompts for website access and recommends minimal grants [2] | Two-origin host access is explicitly approved for background-tab lookup; test actual grants, denial/revocation and `activeTab` fallback |
| An action with a popup does not dispatch `action.onClicked`; popup JavaScript can use extension APIs [3] | The iPhone popup handles its own buttons; it cannot rely on the current desktop click handler firing |
| Safari supports extension background service workers and background documents, with selection rules [4] | Probe the current module service worker on macOS first; use a Safari-only nonpersistent alternative only if needed |
| Safari 26 introduced user shortcut changes in extension settings [5] | Validate the actual shortcut and the available remapping UI on each supported desktop version |
| Current macOS Safari documentation allows temporary folder/ZIP installs without Xcode; they expire on quit or after 24 hours [6] | Useful for a desktop prototype, not a durable installation or an iPhone distribution path |
| Apple offers a local packager and an App Store Connect web packager [7][8] | Xcode is needed for local containing-app/simulator work, not JavaScript builds or recent Safari's desktop temporary install |
| macOS distribution outside the App Store can use a Developer ID-signed, notarized containing app [9] | A separate approved desktop release route; not an equivalent iPhone sideloading option |

**Native compatibility gate, still open:** establish actual URL visibility under approved/denied host grants and `activeTab`, desktop gesture behavior, safe source-tab/window association and same-window tab activation. Source implementation uses documented APIs; this does not waive Safari/device testing.

## Interaction design

### macOS Safari

Keep the Edge desktop model:

- GitHub context submenu: **Open Overview** and **Open JIT Access**.
- Repository portal context item: **Open Repository on GitHub**.
- Toolbar / suggested **Option+Shift+O**: GitHub to Overview, portal to GitHub root.
- No default toolbar popup; context-menu actions use their event's source `tab`, not an active-tab query.
- Unsupported pages open nothing. Badge/title feedback stays best-effort; validate what Safari actually displays. If essential feedback or shortcuts do not work on the proposed minimum version, record the gap and adjust the adapter or support floor before claiming parity.

Retain coarse document/frame URL filters and revalidate the top-level source on invocation. Probe submenu nesting and each supported context rather than copying all Edge context values without checking Safari.

### iPhone Safari

The user enables the containing app's extension, visits a repository, opens Safari's page/More menu, and selects **Open Source Portal Link**. Exact activation/settings labels are recorded for tested iOS versions; do not reuse Edge instructions.

| Source page | Popup content |
| --- | --- |
| Supported GitHub repository | Repository label, **Open Overview**, **Open JIT Access** |
| Supported portal Overview/JIT/subpage | Repository label, **Open on GitHub** |
| Unsupported page or organization | Short explanation; no enabled destination buttons |
| Missing URL / denied or revoked permission | Explain how to grant access or reopen the extension from the source page; do not guess a repository |

Opening the panel alone must not navigate. A button tap reuses a matching tab in the source window or creates one, preserving the source. JIT must be reachable without a keyboard or long-press menu.

Use semantic buttons, comfortable touch targets, responsive layout, light/dark support, readable text scaling, and VoiceOver labels/status announcements. Show loading, denied, unsupported, opening, and failure states inline; do not rely on desktop hover tooltips or badge colors on a phone. Keep scripts/styles local and compatible with extension CSP; render repository text as text, not HTML.

Capture the invoking tab ID and its validated URL only while the popup is open. On a tap, re-read the same tab, verify it is still selected/current and eligible, and fail if it closed/changed. Never substitute another source. Disable buttons while opening and re-enable on confirmed failure. Close only after successful activation or creation. Dismissal cancels pending destination lookup before it can activate/create a tab.

Prefer a self-contained popup with **no iOS background worker**: resolve the active tab on explicit popup opening, then call the shared navigator on a button click. This avoids importing desktop listeners or relying on suspended-worker memory. Verify popup lifetime and navigation completion on a physical iPhone; add a minimal message-driven worker only if measured behavior requires it. Any such fallback needs validated sender, action, and source-tab context, and must not accept arbitrary destination URLs.

## Shared code and build design

### Reuse and small refactors

| File | Implemented change |
| --- | --- |
| `src/repo-url.ts` | Retain the single canonical mapper/allowlist; reuse it from all targets |
| `src/service-worker.ts` | Edge entry point calls the extracted desktop registration; shared navigator and desktop feedback remain separate |
| `tests/repo-url.test.mjs`, `tests/service-worker.test.mjs` | Original cases retained; `tests/helpers/desktop-tests.mjs` exercises both desktop entries, including asynchronous parent-menu creation |
| `public/manifest.json`, `public/icons/` | Remain Edge assets; icons may be copied into Safari outputs without copying the Edge manifest |
| `tsconfig.json`, `scripts/copy-assets.mjs`, `scripts/clean.mjs` | `dist/` remains Edge-only; compiler entry-point selection excludes Safari modules/assets |
| `tests/edge-smoke.mjs` | Keep Edge-specific; it is not a Safari runner |

Added files and generated output locations:

```text
src/
  navigation.ts                  shared allowed-action mapping and safe tab opening
  desktop-actions.ts             reusable desktop menu/action registration
  safari/
    macos-background.ts          desktop Safari entry, no iOS imports
    popup-controller.ts          source-bound mobile navigation state machine
    ios-popup.ts                 popup lifecycle, source binding, buttons and errors
    theme.ts                     external theme script, compatible with extension CSP
safari/
  macos/manifest.json
  ios/manifest.json
  ios/popup.html
  ios/popup.css
tsconfig.safari-macos.json
tsconfig.safari-ios.json
scripts/build-safari.mjs
scripts/package-safari.mjs
tests/
  navigation.test.mjs
  safari-popup.test.mjs
  safari-desktop.test.mjs
  safari-build.test.mjs
apple/                           not generated here; requires full Xcode
  macos/                         separate macOS containing-app project
  ios/                           separate iPhone containing-app project
build/
  safari/macos/                 generated extension resources only
  safari/ios/                   generated extension resources only
```

`navigation.ts` accepts a source-tab context, fixed destination enum, narrow tab API adapter and optional popup cancellation check. It constructs URLs through `repo-url.ts`, looks for a validated same-window match, activates it without a URL update, or attempts one creation. It returns success/failure plus whether a tab was reused. Desktop badge/title and mobile inline status are separate presentation adapters; feedback failures cannot block navigation.

Desktop registration is explicitly invoked by each desktop entry, synchronously during module loading. The iPhone popup imports only the shared navigator/mapper and mobile controller; loading it does not touch `contextMenus`, `commands`, runtime install listeners, or desktop action feedback. This import boundary is tested with only a `tabs` API.

The port retains `chrome.*` with no polyfill or new dependencies. Menu creation waits for each completion callback before creating its children; the callback reads `runtime.lastError`. The popup's theme script and CSS are external local assets rather than inline code, preserving MV3 CSP.

### Target manifests

| Contract | Edge | Safari macOS development build | Safari iPhone development build |
| --- | --- | --- | --- |
| Manifest | MV3 | MV3, Safari-specific metadata | MV3, Safari-specific metadata |
| API permissions | `activeTab`, `contextMenus` | `activeTab`, `contextMenus` | `activeTab` |
| Host permissions | Exact HTTPS GitHub and portal | Same two origins | Same two origins |
| Action | No popup; direct handler | No popup; direct handler | `default_popup`; explicit destination buttons |
| Background | Module service worker | Module service worker first; tested nonpersistent alternative if required | None initially |
| Menus / commands | Existing | Tested desktop menus and `_execute_action` shortcut | No `contextMenus` permission, menu code, or keyboard command |
| Version floor | Existing `minimum_chrome_version` | Apple deployment settings and tested Safari floor; omit Chromium-only key | Apple deployment settings and tested iOS floor; omit Chromium-only key |

The user approved `https://github.com/*` and `https://repos.opensource.microsoft.com/*` for background-tab URL lookup in version 0.3.0. This intentionally supersedes the earlier no-host design; it does not authorize more origins or broad `tabs`, `<all_urls>`, or `scripting` permissions. Host grants cover these origins beyond the eight organizations, but routing/reuse still enforce the allowlist. Browser access warnings can describe broader data capabilities; the code reads tab metadata only on invocation.

### Build/output guarantees

- Preserve existing `npm run build`, `npm test`, `npm run test:edge`, and Edge installation from `dist/`.
- `build:safari:macos`, `build:safari:ios`, and `build:safari` use compiler-only target configs and explicit asset lists.
- Edge's compiler includes only its worker entry and imported modules. Safari assets live outside `public/` so the existing Edge copy step cannot copy a mobile manifest/popup.
- Each build cleans only its own known generated subtree. Building or failing a Safari target must not delete or overwrite a working Edge build or an Apple project.
- Each Safari output has `manifest.json` at its root and only the relevant compiled modules/icons/UI assets; no source, tests, dependencies, other target manifest, signing data, or session files.
- Generated Safari outputs, Xcode DerivedData/build products, per-user Xcode files and signing material are ignored. Keep intentional future native project configuration reproducible.
- The Safari build validates that package/Edge/Safari manifest versions agree at 0.3.0. Generated Apple target versions/build numbers must be inspected during packaging; use Apple's separate build-number increments for uploads.
- `npm test` builds all targets and runs their focused cases; `npm run test:safari` builds Safari and runs its focused cases. `npm run build` remains Edge-only.

## Implementation sequence and dependencies

Implementation is authorized; release actions are not. Source dependencies are complete, but native compatibility/package/device evidence remains open. Edge store publication is not a prerequisite.

| ID | Status | Work/evidence | Prerequisites for remaining work |
| --- | --- | --- | --- |
| `safari-compatibility` | Partial / blocked | Documentation/tool checks complete; real grant, worker, popup and support-floor probes not run | User local desktop testing; full Xcode/simulator and later authorized device access |
| `safari-shared-navigation` | Done | Shared navigator and explicit desktop registration; original tests plus native Edge regression pass | None for completed source work |
| `safari-target-builds` | Done | Isolated manifests, entry points, asset lists, version checks and build commands; output isolation verified | None |
| `safari-macos-entry` | Source done; native pending | Desktop handler suite passes for Safari entry; menus/direct action/shortcut/wake need Safari itself | `safari-compatibility` desktop checks |
| `safari-iphone-popup` | Source done; native pending | Conditional actions, accessibility markup, source-bound navigation, errors and duplicate-tap tests pass | `safari-compatibility` mobile checks |
| `safari-apple-projects` | Helper done / blocked | Packaging helper selects platform/tool, builds resources, rejects overwrite and fails clearly without Xcode; no Apple project generated | `safari-target-builds`, full Xcode; authorized identifiers/team for actual packaging |
| `safari-device-validation` | Blocked | Node coverage and native Edge checks pass; Safari matrix below has not run | Compatibility, desktop/mobile source, generated Apple projects; physical iPhone |
| `safari-user-docs` | Development docs done; release docs pending | README includes local folder loading, mobile usage, packaging, permissions and explicit limitations | Device-validation evidence for actual version floors and confirmed settings labels |
| `safari-release-preparation` | Deferred | Signed archives, authorized publisher/channel, support/privacy assets and review instructions | Device validation, finalized user docs, separate release authorization |
| `safari-distribution` | Deferred | Approved beta/release distribution and clean install/update validation | Release preparation and explicit upload/submission approval |

Source implementation is tested while native validation remains blocked. Do not treat compilation, packaging scaffolding or Node mocks as a native Safari pass. If grant, window/reuse or popup-lifetime checks fail, make the smallest adapter correction without expanding beyond the approved two origins.

## Verification plan and acceptance gates

### Automated coverage

Preserve all existing mapper/worker cases. Add focused tests for the shared navigator and iPhone action selection: exact Overview/JIT/reverse URLs, unsupported sources, missing grants, closed/changed tabs, multiple rapid taps, API rejection, and no global or cross-tab fallback. Confirm denied requests never navigate or leak raw source URLs in logs.

Test desktop initialization with the capabilities actually used by Safari, and test that the iOS import path works without `contextMenus`, `commands`, or desktop feedback APIs. Inspect generated manifests and asset paths for target isolation. Run clean builds in different orders, including rebuilding Edge after Safari, to catch stale or cross-copied output.

Node tests can cover logic, not Safari grants or actual extension UI. Playwright's WebKit engine and the existing Chromium/CDP runner are not substitutes for Safari Web Extension testing. Use real Safari UI and Xcode/device tooling for the native checks; add repeatable automation only where it can exercise the real extension.

### Native matrix

| Area | macOS Safari | iPhone Safari |
| --- | --- | --- |
| Activation | Temporary install for prototype; packaged app enable/disable/reload | Containing app install, extension enablement, page/More menu entry |
| Supported sources | Roots, nested GitHub pages, Overview/JIT portal pages, client-side navigation | Same; mobile GitHub routes and actual iPhone page transitions |
| Destinations | Both submenu choices, reverse menu, toolbar, shortcut | Overview/JIT buttons on GitHub; GitHub button on portal |
| Source integrity | Different-link click and mixed-origin frame cannot override top-level page | Tab switch, navigation, closed source, popup dismiss/reopen cannot use stale/wrong source |
| Permissions | Fresh profile; first grant, denied/revoked/expired grant; each invocation gesture | Same for both origins; URL availability when popup opens and on tap |
| Placement/reuse | Matching tab activated without URL changes; otherwise new tab in source window. Other windows/private contexts excluded; Overview/JIT separate | Same when a usable source window ID exists; otherwise new-tab fallback. Verify tab-group/private-context behavior, not desktop assumptions |
| Lifecycle | Background idle/termination/restart; browser/app restart; no duplicate menus after update | Popup dismissal, app background/resume, Safari restart, repeated openings, no persisted stale tab |
| Errors/access | Unsupported pages, failures, unavailable portal/sign-in | Inline messages; denied site access, offline/errors, visible destination and normal sign-in |
| Accessibility | Keyboard and visible feedback | VoiceOver, text scaling, light/dark, portrait/landscape, adequate touch targets |
| Private browsing | Explicitly allowed and disallowed configurations; never cross into an unrelated context | Same; do not auto-enable private access or imply existing site grants enable the extension everywhere |

For each claimed platform, record OS/Safari version, package version, installation route, grant state, expected/observed URL and outcome. Use public repository fixtures for routing; use authorized accounts only for optional portal access checks and do not save credentials or confidential screenshots.

**Release gates:** no Edge regressions; actual two-site grants and denied-lookup fallback established on Safari; exact destination/source binding, reuse isolation and section separation demonstrated; desktop UI/shortcut working on the declared floor; all iPhone actions working on a physical iPhone, not only simulator; packaged installation/relaunch/update verified. Unavailable hardware/signing blocks the affected gate, not a pass.

Correct JIT navigation is required. Successful JIT authorization or access grants are not extension functionality. Mobile portal usability and sign-in restrictions must be disclosed if they limit the experience despite correct routing.

## Apple packaging and distribution

### Local development path

Use a Mac with a compatible full Xcode installation and iPhone simulator for implementation. Current Safari's temporary desktop folder/ZIP loading is useful for initial probes; if unavailable on the chosen baseline, use the generated macOS containing app instead. Temporary loading is not a permanent install and does not establish iPhone support [6].

`npm run package:safari -- <macos|ios> --bundle-identifier <authorized.id>` checks for `safari-web-extension-packager`, falling back to its older `safari-web-extension-converter` name [7]. It rebuilds the selected resources and invokes `xcrun` with the platform-only, Swift, no-open and no-prompt flags. It performs no signing or uploads. Here, the missing-tool guard failed as intended before project generation.

**Implementation adjustment:** use separate maintained projects under `apple/macos/` and `apple/ios/` rather than one combined project. Each is generated directly from its platform resource directory, avoiding hand-edited shared resource membership or mixing manifests. The helper does not use `--copy-resources`: Apple's documented default references the original generated resources. It refuses to overwrite an existing target directory; native edits are never silently discarded.

Generate each project once when Xcode is available, then rebuild the matching extension resources before building/running it in Xcode. Review resource membership after adding/removing modules. Validate clean-clone/resource paths, resource freshness, app/extension version settings, iPhone device-family settings, and missing-output behavior before maintaining/committing generated native projects or claiming packaging complete. None of those Xcode checks ran here.

Keep the generated native wrappers minimal: explain how to enable/use the extension and link to approved support/privacy information. Do not add a native URL router, embedded portal browser, login flow, native messaging, or App Groups unless a proven requirement needs them. Use authorized bundle identifiers/signing teams; keep credentials/certificates/profiles out of source.

iPhone simulator work can begin before enrollment. Apple documents Developer Program membership for physical-device testing of these extensions; treat membership, signing, a permitted test device, and organizational policies as prerequisites to validate before the physical-device gate [6][9]. An installed iOS app still requires the user to enable its Safari extension.

### Distribution choices, approval-gated

| Stage/platform | Proposed path | Important boundary |
| --- | --- | --- |
| Initial macOS testing | Temporary extension or local containing app | Development only; unsigned/temporary state resets as documented |
| iPhone development | Xcode simulator, then signed physical-device installation | An Edge ZIP is not directly installable as an iPhone extension |
| Beta testing | TestFlight for approved macOS/iOS builds | Requires developer account, App Store Connect setup/signing, and applicable beta review; not a permanent release channel |
| Durable Apple distribution | Mac App Store / iOS App Store | Containing apps, privacy/support/listing assets and Apple review; users enable extensions in Safari |
| Optional macOS-only direct distribution | Developer ID-signed and notarized containing app | Separate approved channel and update plan; no equivalent generic iPhone route is assumed |

Apple's App Store Connect web packager can package extension resources without a local Mac/Xcode, then support TestFlight/App Store distribution [8]. It is an alternative release pipeline, not proof that desktop/mobile manifests can be mixed or that device validation is unnecessary. Confirm support for the chosen separate resource sets before selecting it over the maintained Xcode project.

The earlier **Hidden Edge listing** choice does not automatically map to Apple. Before Apple release preparation, choose an authorized publisher and appropriate distribution/visibility arrangement; do not promise hidden, employee-only, or private access. Any restricted distribution option requires its own eligibility/review decision. Store approval, publisher branding, account enrollment, paid membership, terms acceptance, device provisioning, upload, and submission require separate authorization.

Finalize app/extension identifiers, version/build metadata, required app/extension artwork, actual macOS/iPhone screenshots, support URL, privacy policy and accurate data-use answers. Explain local URL processing and user-directed destination navigation, not "no data accessed." Give reviewers safe routing steps and portal sign-in limitations without supplying employee credentials or automating privileged JIT actions.

After an approved beta/release, verify a clean Mac and physical iPhone install, enablement, permissions, every relevant entry point, update persistence, and correct version. Record links and update instructions only when they exist. Keep the Edge Add-ons release independent.

## Decisions and evidence to resolve during implementation

| Decision | Planning default | Required evidence/approval before claiming support |
| --- | --- | --- |
| Exact version floor | Current stable desktop/iPhone releases first; no legacy promise | Record tested Safari/OS/Xcode versions and deployment targets after compatibility probes |
| iPhone UI | Explicit action popup; no context menu or keyboard dependency | Real popup invocation, usable controls, grant/source behavior and accessibility |
| Desktop background | Existing MV3 module-worker model | Actual startup, menu setup, action/shortcut and wake tests; Safari-only fallback if necessary |
| Permission budget | Desktop `activeTab` + `contextMenus`; iPhone `activeTab`; both targets have approved GitHub/portal host grants | Actual granted/denied/revoked access and safe lookup fallback pass; further expansion needs approval |
| iPhone source/window semantics | Bind to invoking tab; never substitute another tab | Prove fresh URL revalidation and destination placement, including tab groups/private mode |
| Packaging | Local Xcode with separate target resources | Correct resources in both app bundles and reproducible clean rebuilds |
| Distribution identity/channel | TestFlight first; durable channel chosen separately | Authorized Apple team, signing, assets, applicable review and explicit release approval |

## Sources

1. [Apple: Assessing Safari Web Extension browser compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
2. [Apple: Managing Safari Web Extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions)
3. [MDN: action API and popup/click behavior](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action)
4. [MDN: background manifest and Safari environments](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
5. [MDN: commands and Safari shortcut remapping](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands)
6. [Apple: Running a Safari Web Extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
7. [Apple: Packaging an extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
8. [Apple: Packaging and distribution through App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)
9. [Apple: Distributing a Safari Web Extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)

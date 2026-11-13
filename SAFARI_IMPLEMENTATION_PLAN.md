# Safari Implementation Plan: macOS and iPhone

**Status: planned, not implemented.** The current version 0.2.0 build supports Microsoft Edge. This document plans adding Safari on macOS and iPhone without regressing Edge. It authorizes no implementation, developer-account changes, signing, uploads, or publication.

The [main implementation plan](IMPLEMENTATION_PLAN.md#implementation-status) remains the status index for completed Edge work. All Safari work below is pending. Apple and MDN documentation was reviewed for this plan; documentation compatibility is not evidence that this extension works in Safari.

## Goal and scope

Reuse the current TypeScript URL mapper, eight-organization allowlist, and Overview/JIT/GitHub destinations. Add small platform-specific entry points, isolated build outputs, and Apple packaging rather than rewriting the extension.

| Target | Planned experience | Status |
| --- | --- | --- |
| Microsoft Edge desktop | Existing menus, direct toolbar action, and shortcut stay unchanged | Implemented; regression gate |
| Safari on macOS | Overview/JIT context submenu, reverse GitHub menu, direct toolbar action, and desktop shortcut | Planned |
| Safari on iPhone | Open the extension from Safari's page/More menu, then choose a destination in a touch-friendly popup | Planned |

Both Safari targets use the current top-level page, never a clicked link, selected text, embedded frame, or cached repository from another tab. Preserve repository case, canonical organization spelling, and rejection of unsupported origins/routes/organizations. Open one new destination tab per successful invocation; leave the source tab open.

JIT remains navigation to `/jit` only. No automatic access requests, approvals, credentials, portal APIs, repository-existence checks, telemetry, or GitHub/portal page injection.

**Initial scope defaults:** retain the current desktop interaction; add a popup only for iPhone; target current stable macOS Safari and iOS Safari first. Record exact Safari, macOS, iOS, Xcode, and deployment-minimum versions during the compatibility phase before promising a supported version range. Older releases require additional testing rather than an assumption based on MV3 support.

Chrome support is not restored. iPad-specific UX, visionOS, Safari web apps, embedded in-app browsers, Share Sheet integration, external-keyboard shortcuts on iPhone, settings, and configurable organizations are not initial targets. Configure Apple device-family/availability settings accordingly; do not claim these platforms merely because a generated app can run there.

## Verified platform facts and remaining questions

| Documented fact | Consequence for this project |
| --- | --- |
| Safari supports `chrome.*` and `browser.*`, callbacks and promises; MV3 support exists from Safari 15.4 [1] | Keep the current namespace and compiler-first approach unless a tested API difference requires a small adapter. This does not establish a minimum supported Safari version |
| `contextMenus` / `menus` are unsupported on iOS [1] | Do not include or register desktop context menus in the iPhone target |
| Safari prompts for website access and recommends `activeTab` to minimize access [2] | Test fresh grants, denial, revocation, and both source origins; never silently expand permissions |
| An action with a popup does not dispatch `action.onClicked`; popup JavaScript can use extension APIs [3] | The iPhone popup handles its own buttons; it cannot rely on the current desktop click handler firing |
| Safari supports extension background service workers and background documents, with selection rules [4] | Probe the current module service worker on macOS first; use a Safari-only nonpersistent alternative only if needed |
| Safari 26 introduced user shortcut changes in extension settings [5] | Validate the actual shortcut and the available remapping UI on each supported desktop version |
| Current macOS Safari documentation allows temporary folder/ZIP installs without Xcode; they expire on quit or after 24 hours [6] | Useful for a desktop prototype, not a durable installation or an iPhone distribution path |
| Apple offers a local packager and an App Store Connect web packager [7][8] | Local Xcode is the preferred development route here; cloud packaging is a later release option, not mandatory |
| macOS distribution outside the App Store can use a Developer ID-signed, notarized containing app [9] | A separate approved desktop release route; not an equivalent iPhone sideloading option |

**Compatibility gate:** establish whether `activeTab` alone exposes the invoking tab URL through the proposed iPhone popup flow, whether Safari desktop grants access on each supported gesture, and whether safe source-tab/window association is retained. Verify actual behavior before finalizing manifests. Apple API documentation or passing Node mocks cannot close this gate.

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

Opening the panel alone must not navigate. Each successful button tap opens one new selected Safari tab and preserves the source. JIT must be reachable without a keyboard or long-press menu.

Use semantic buttons, comfortable touch targets, responsive layout, light/dark support, readable text scaling, and VoiceOver labels/status announcements. Show loading, denied, unsupported, opening, and failure states inline; do not rely on desktop hover tooltips or badge colors on a phone. Keep scripts/styles local and compatible with extension CSP; render repository text as text, not HTML.

Capture the invoking tab ID and its validated source URL only while the popup is open. On a destination tap, re-read that same tab, revalidate eligibility, and fail with a refresh/reopen message if the tab closed or its URL changed. Never fall back to a different active tab. Disable buttons while opening to prevent duplicate taps and re-enable on a confirmed failure. Close the popup only after a successful creation result.

Prefer a self-contained popup with **no iOS background worker**: resolve the active tab on explicit popup opening, then call the shared navigator on a button click. This avoids importing desktop listeners or relying on suspended-worker memory. Verify popup lifetime and navigation completion on a physical iPhone; add a minimal message-driven worker only if measured behavior requires it. Any such fallback needs validated sender, action, and source-tab context, and must not accept arbitrary destination URLs.

## Shared code and build design

### Reuse and small refactors

| Existing file | Planned change |
| --- | --- |
| `src/repo-url.ts` | Retain the single canonical mapper/allowlist; reuse it from all targets |
| `src/service-worker.ts` | Remain the Edge entry point; extract only reusable navigation/menu behavior and preserve existing behavior |
| `tests/repo-url.test.mjs`, `tests/service-worker.test.mjs` | Keep current cases as regressions; add focused cases for any shared refactor |
| `public/manifest.json`, `public/icons/` | Remain Edge assets; icons may be copied into Safari outputs without copying the Edge manifest |
| `tsconfig.json`, `scripts/copy-assets.mjs`, `scripts/clean.mjs` | Keep `dist/` as the existing Edge output. Narrow entry-point selection so Safari modules/assets do not leak into Edge |
| `tests/edge-smoke.mjs` | Keep Edge-specific; it is not a Safari runner |

Proposed new files, to be created only during implementation:

```text
src/
  navigation.ts                  shared allowed-action mapping and safe tab opening
  desktop-actions.ts             reusable desktop menu/action registration
  safari/
    macos-background.ts          desktop Safari entry, no iOS imports
    ios-popup.ts                 popup lifecycle, source binding, buttons and errors
safari/
  macos/manifest.json
  ios/manifest.json
  ios/popup.html
  ios/popup.css
tsconfig.safari-macos.json
tsconfig.safari-ios.json
scripts/build-safari.mjs
tests/
  navigation.test.mjs
  safari-popup.test.mjs
  safari-build.test.mjs
apple/
  OpenSourcePortal/              generated then maintained Xcode project/targets
build/
  safari/macos/                 generated extension resources only
  safari/ios/                   generated extension resources only
```

`navigation.ts` accepts a validated source-tab context and a fixed destination enum, not arbitrary URLs. It constructs destinations through `repo-url.ts`, attempts one tab creation, and returns a structured success/failure result. Desktop badge/title updates and mobile inline feedback are presentation adapters; feedback failures cannot prevent an otherwise valid open. Do not copy Edge's `windowId` assumptions unexamined into iOS.

Desktop registration must be explicitly invoked by the appropriate entry point. Merely guarding one menu call is insufficient: the current worker registers `contextMenus.onClicked` at module load, which cannot be imported into the iPhone popup. Keep iOS imports free of desktop initialization side effects.

Keep `chrome.*` where supported; no blanket namespace rewrite or polyfill dependency is planned. Introduce only the compatibility handling justified by the prototype. Preserve top-level synchronous desktop listener registration for background restart.

### Target manifests

| Contract | Edge, unchanged | Safari macOS, proposed | Safari iPhone, proposed |
| --- | --- | --- | --- |
| Manifest | MV3 | MV3, Safari-specific metadata | MV3, Safari-specific metadata |
| Permissions | `activeTab`, `contextMenus` | Start with `activeTab`, `contextMenus` | Start with `activeTab` only |
| Host permissions | None | None initially | None initially |
| Action | No popup; direct handler | No popup; direct handler | `default_popup`; explicit destination buttons |
| Background | Module service worker | Module service worker first; tested nonpersistent alternative if required | None initially |
| Menus / commands | Existing | Tested desktop menus and `_execute_action` shortcut | No `contextMenus` permission, menu code, or keyboard command |
| Version floor | Existing `minimum_chrome_version` | Apple deployment settings and tested Safari floor; omit Chromium-only key | Apple deployment settings and tested iOS floor; omit Chromium-only key |

Querying a tab or creating a destination is not by itself a reason to add the broad `tabs` permission. Verify URL visibility under the actual Safari grant. If a target genuinely requires host access, stop at the compatibility gate and propose the smallest exact-origin change for approval; do not silently add `<all_urls>`, `tabs`, `scripting`, or persistent website access. Keep Edge permissions unchanged regardless.

### Build/output guarantees

- Preserve existing `npm run build`, `npm test`, `npm run test:edge`, and Edge installation from `dist/`.
- Add proposed `build:safari:macos`, `build:safari:ios`, and `build:safari` commands with compiler-only target configs and explicit asset lists. These commands do not exist yet.
- Keep target output outside `dist/`. The current `src/**/*.ts` inclusion and recursive `public/` copy need target selection, not an extra blanket copy step.
- Each build cleans only its own known generated subtree. Building or failing a Safari target must not delete or overwrite a working Edge build or an Apple project.
- Each Safari output has `manifest.json` at its root and only the relevant compiled modules/icons/UI assets; no source, tests, dependencies, other target manifest, signing data, or session files.
- Add generated Safari outputs, Xcode DerivedData/build products, and per-user Xcode files to ignore rules. Keep the intentional project configuration reproducible.
- Source product versions from one deliberate release version and validate agreement across manifests and Apple target settings; use Apple's separate build-number increments for uploads. Do not change the current Edge version during planning.

## Implementation sequence and dependencies

All rows are **planned/pending**, not done. Approval to implement the port is required before starting them. Edge store publication is not a prerequisite for Safari development.

| ID | Work | Prerequisites | Completion evidence |
| --- | --- | --- | --- |
| `safari-compatibility` | Record target/tool versions; probe macOS worker/menus/shortcut and iPhone popup/source URL access with minimal permissions | Implementation approval | Exact supported-baseline proposal and actual capability/grant results; blockers recorded rather than hidden |
| `safari-shared-navigation` | Extract reusable navigator and desktop registration without changing Edge behavior | `safari-compatibility` | Existing 23 tests and native Edge checks remain passing; no iOS import side effects |
| `safari-target-builds` | Add isolated manifests, compiler configs, asset lists, and build commands using the probe entry points initially | `safari-shared-navigation` | Target scaffolds build independently with exact permissions/resources; complete Safari behavior remains in the next two tasks |
| `safari-macos-entry` | Implement desktop Safari wiring and any narrowly needed API adaptations | `safari-target-builds` | Overview/JIT/reverse menus, direct action, shortcut and restart behavior exercised in Safari |
| `safari-iphone-popup` | Implement touch/accessible popup and source-bound navigation | `safari-target-builds` | Correct conditional actions, denied/changed/closed-tab handling, and one-tab-per-tap behavior |
| `safari-apple-projects` | Create containing apps/extension targets and reproducible target resource sync | `safari-target-builds` | macOS app and iPhone simulator builds contain the right manifests/resources; signing prerequisites identified |
| `safari-device-validation` | Run regression, macOS, iPhone simulator, and physical-device matrix | `safari-macos-entry`, `safari-iphone-popup`, `safari-apple-projects` | Actual versions/results recorded; physical iPhone gate passes or remains explicitly blocked |
| `safari-user-docs` | Write activation, permissions, usage, troubleshooting, and supported-version instructions | `safari-device-validation` | Instructions match observed behavior; Safari support is claimed only for passing targets |
| `safari-release-preparation` | Finalize publisher identity, signed archives, privacy/support assets, screenshots and review instructions | `safari-device-validation`, `safari-user-docs`, separate release authorization | Tested, inspectable release candidates and approved disclosure/identity choices |
| `safari-distribution` | Distribute approved beta/release builds and verify clean installs/updates | `safari-release-preparation`, explicit upload/submission approval | TestFlight/App Store or approved notarized macOS installation validated; actual links/versions recorded |

The small compatibility probe may use temporary prototype resources and a minimal generated simulator host before the maintained builds/project work. Start with real macOS Safari and iPhone simulator behavior; retain the physical-iPhone gate for support claims. The target-build phase can compile those minimal entry points before desktop/mobile features are finished, avoiding a dependency on yet-unimplemented full handlers. Clean up superseded prototype artifacts; do not treat successful scaffolding as completed runtime validation or ship placeholder features.

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
| Placement | New active tab in source window; original stays; multiple windows | New selected Safari tab; source stays; verify tab-group/private-context behavior, not desktop window assumptions |
| Lifecycle | Background idle/termination/restart; browser/app restart; no duplicate menus after update | Popup dismissal, app background/resume, Safari restart, repeated openings, no persisted stale tab |
| Errors/access | Unsupported pages, failures, unavailable portal/sign-in | Inline messages; denied site access, offline/errors, visible destination and normal sign-in |
| Accessibility | Keyboard and visible feedback | VoiceOver, text scaling, light/dark, portrait/landscape, adequate touch targets |
| Private browsing | Explicitly allowed and disallowed configurations; never cross into an unrelated context | Same; do not auto-enable private access or imply existing site grants enable the extension everywhere |

For each claimed platform, record OS/Safari version, package version, installation route, grant state, expected/observed URL and outcome. Use public repository fixtures for routing; use authorized accounts only for optional portal access checks and do not save credentials or confidential screenshots.

**Release gates:** no Edge regressions; narrow permissions established on both Safari targets; exact destination and source binding demonstrated; desktop UI/shortcut working on the declared floor; all iPhone actions working on a physical iPhone, not only simulator; packaged installation/relaunch/update verified. If access to hardware or signing is unavailable, mark the affected gate blocked and do not label iPhone support complete.

Correct JIT navigation is required. Successful JIT authorization or access grants are not extension functionality. Mobile portal usability and sign-in restrictions must be disclosed if they limit the experience despite correct routing.

## Apple packaging and distribution

### Local development path

Use a Mac with a compatible full Xcode installation and iPhone simulator for implementation. Current Safari's temporary desktop folder/ZIP loading is useful for initial probes; if unavailable on the chosen baseline, use the generated macOS containing app instead. Temporary loading is not a permanent install and does not establish iPhone support [6].

Use `xcrun safari-web-extension-packager` to create the macOS and iOS containing-app/extension targets from the respective generated resource folders. Older Xcode tooling called this `safari-web-extension-converter`; check the installed tool rather than assuming either executable exists [7]. No command is run by this plan.

Prefer one maintained Xcode project with separate macOS/iOS app and extension targets and target-specific resource sets. Never share one manifest file between platform targets by accident. The packager links original resources by default; either deliberately reference the generated target outputs or use `--copy-resources` with an explicit sync/build phase. Test that rebuilding updates the packaged resources and that missing/stale outputs fail the package build.

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
| Permission budget | Desktop `activeTab` + `contextMenus`; iPhone `activeTab` | Both origins and permission states pass without broader access; any expansion needs approval |
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

# GitHub Open Source Portal Extension: Ideas

**Status:** version 0.3.0 adds approved same-window tab reuse to Overview/JIT and portal-to-GitHub navigation. Edge is natively verified. Safari desktop and iPhone source/build targets are implemented for development testing; native Safari/device validation and Apple packaging remain incomplete. See [SAFARI_IMPLEMENTATION_PLAN.md](SAFARI_IMPLEMENTATION_PLAN.md), [README.md](README.md) for setup, and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#implementation-status) for completed work.

## The useful, small version

While viewing a supported GitHub repository, open its Microsoft open source management portal Overview or JIT page. From a repository's portal page, go back to GitHub:

```text
GitHub: https://github.com/{org}/{repo}/...
Portal: https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}
JIT:    https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}/jit
Return: https://github.com/{org}/{repo}
```

Working name: **Open Source Portal Link**.

The extension should feel like a browser shortcut, not another application. Desktop variants need no dashboard, login screen, popup, or GitHub page modifications. The iPhone variant uses a small action popup because Safari on iOS does not support extension context menus.

## Current Edge experience

| Entry point | Behavior |
| --- | --- |
| Right-click inside a GitHub repository page | `Microsoft Open Source Portal` submenu with `Open Overview` and `Open JIT Access` |
| Right-click inside a repository's portal page | `Open Repository on GitHub` |
| Toolbar icon | GitHub → portal Overview; portal → GitHub repository root, without a popup |
| Keyboard | `Alt+Shift+O`, or `Option+Shift+O` on macOS; same behavior as the toolbar |

Each invocation activates a matching destination in the source window without changing its URL, or opens a new focused tab if none can be reused. GitHub matches any subpage of the same repository; portal Overview and JIT remain separate. The source stays open. The original Overview shortcut is unchanged on GitHub; JIT is an explicit right-click choice.

GitHub subpages identify the repository through the first two URL path segments. Portal sources must match `/orgs/{org}/repos/{repo}`; Overview, `/jit`, and other repository subpages return to the GitHub root.

Right-clicking a link to a different repository still refers to the repository of the page being viewed. Link-target opening is deliberately excluded from the MVP.

**Two exact origins only:** portal-opening actions require the top-level `https://github.com/{org}/{repo}` URL; reverse actions require `https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}`. Both use the same eight-organization allowlist. Reject other top-level pages even if they contain eligible links or frames.

The context menus are filtered to matching GitHub or portal documents. Browser menu filters also apply to frames, so they cannot guarantee perfect top-level-page visibility in mixed-origin embeds. Regardless of menu visibility, the top-level source URL and chosen direction must pass validation before anything opens.

This is a runtime URL check, not a hostname restriction built into `activeTab`. Keep temporary, user-invoked URL access and do not request persistent access to other sites.

## Supported organizations

- `Azure`
- `Azure-Samples`
- `microsoft`
- `MicrosoftDocs`
- `dotnet`
- `microsoftfeedback`
- `microsoftarchive`
- `microsofthackathons`

Organization matching is case-insensitive. Generated links use the canonical organization spelling above and preserve the repository-name spelling from the URL.

## Design choices

**Keep permissions narrow.** Desktop API permissions are `activeTab` and `contextMenus`; iPhone uses `activeTab`. The user approved HTTPS host access limited to `github.com` and `repos.opensource.microsoft.com` for finding background destination tabs. Do not request broad `tabs`/`<all_urls>` access. Inspect URLs on explicit invocation, never through continuous monitoring or page-content reads; Safari grants still need native checks.

**Accept a simple menu filter.** The menus can appear on repository-shaped GitHub/portal pages outside the allowlist. Invocation performs the real validation. Do not promise exact menu visibility for every frame or introduce continuous browsing access to achieve it.

**Fail quietly but visibly.** Unsupported pages open nothing. Desktop uses a `!` badge and toolbar tooltip; iPhone shows inline popup status. Pinning the extension makes desktop feedback easier to find.

**Let the portal own authentication.** The browser opens the portal normally, using the user's existing session or the portal's sign-in flow. The extension never handles credentials or bypasses access checks.

**Do not equate an organization with open-source status.** This is only a URL mapping tool. It does not verify repository existence, visibility, licensing, or portal onboarding.

**Keep the implementation small.** Use TypeScript, a compiler-only build, and a shared pure URL-mapping module. The current `dist/` and native smoke test still target Edge. Safari manifests, entry points and outputs are isolated from Edge; do not duplicate routing logic or reinstate Chrome support.

**Learn extension comparison.** The installed Learn Content Metrics extension's Details page displays `Read your browsing history` and `Display notifications`, with automatic read/change access on Learn production, dev, PR-dev, and localhost. Do not copy those sites/permissions; our reuse feature needs only its two declared origins and no notifications. The general site-permissions page contains origin defaults, not requested extension permissions. See the [observed comparison](IMPLEMENTATION_PLAN.md#reference-learn-extension-permissions).

## Repository-to-portal mapping examples

| GitHub repository URL | Portal overview URL |
| --- | --- |
| `https://github.com/Azure/azure-functions-agents-runtime` | `https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime` |
| `https://github.com/Azure-Samples/Durable-Task-Scheduler` | `https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler` |
| `https://github.com/microsoft/vscode` | `https://repos.opensource.microsoft.com/orgs/microsoft/repos/vscode` |
| `https://github.com/MicrosoftDocs/azure-docs` | `https://repos.opensource.microsoft.com/orgs/MicrosoftDocs/repos/azure-docs` |
| `https://github.com/dotnet/runtime` | `https://repos.opensource.microsoft.com/orgs/dotnet/repos/runtime` |

These are URL-mapping examples, not claims that portal onboarding or account access has been verified. A nonexistent repository with a valid URL shape still produces a destination; existence checks are deliberately outside scope.

### Nested repository pages

These pages all open the same portal destination:

```text
https://github.com/Azure-Samples/Durable-Task-Scheduler
https://github.com/Azure-Samples/Durable-Task-Scheduler/issues/42
https://github.com/Azure-Samples/Durable-Task-Scheduler/pull/17/files
https://github.com/Azure-Samples/Durable-Task-Scheduler/blob/main/README.md
```

Destination:

```text
https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler
```

Nested paths are illustrative; they do not assert that a particular issue, pull request, branch, or file exists.

## Implemented: choose Overview or JIT

Version 0.2.0 introduced two explicit destinations in the GitHub context submenu, retained in 0.3.0:

| Destination | URL shape |
| --- | --- |
| Overview | `https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}` |
| JIT access page | `https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}/jit` |

The user supplied these examples:

```text
Overview:
https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime

JIT:
https://repos.opensource.microsoft.com/orgs/Azure/repos/azure-functions-agents-runtime/jit
```

Overview is the root repository portal URL, not a guessed `/overview` route. JIT appends exactly `/jit`, using the user-supplied route. Mapping and handler tests cover both; authenticated cross-repository portal behavior has not been independently verified.

The context submenu contains `Open Overview` and `Open JIT Access`. The initial Overview shortcut is intact; a separate configurable JIT shortcut remains a future option.

Opening JIT must only navigate to its page. The extension must not request or grant access automatically; all authentication, authorization, and approval remain with the portal.

## Implemented: return to GitHub

On the portal Overview, JIT, or another repository subpage, `Open Repository on GitHub`, the toolbar, and the existing shortcut activate an existing same-window GitHub repository page if available. Otherwise they open `https://github.com/{org}/{repo}`. New URLs preserve canonical organization/repository spelling and omit source nested paths, queries and fragments; reused tabs keep their current page intact.

The original reverse mapping needed no extra permissions; version 0.3.0's approved tab lookup adds only GitHub/portal host access. No page injection or GitHub/portal API calls are added. Portal landing pages, malformed routes, and unsupported organizations remain ineligible.

## Development implementation: Safari on macOS and iPhone

Desktop Safari shares the menu/toolbar/shortcut handlers; iPhone uses a touch-friendly extension popup with Overview/JIT or GitHub buttons based on the source page. All targets share current-page validation, the eight organizations, same-window reuse/new-tab fallback, and navigation-only JIT. Mobile reuse is skipped if no usable source window ID exists.

Separate builds are available in `build/safari/macos/` and `build/safari/ios/`. Recent desktop Safari can temporarily load its folder without Xcode. The iPhone target requires a containing iOS app; the helper generates separate native projects when full Xcode is available. The [Safari implementation plan](SAFARI_IMPLEMENTATION_PLAN.md) distinguishes completed source/tests from blocked native compatibility, packaging, and device checks. No Apple publication or account changes have occurred.

## Ideas for later, beyond the Safari port

| Idea | Why defer it |
| --- | --- |
| Separate JIT shortcut | Useful for frequent JIT users, but needs an additional command and shortcut-conflict testing |
| Preferred Overview/JIT toolbar destination | Needs a settings experience, persistence, and a decision about the shared toolbar/keyboard action |
| Copy the Overview or JIT URL | Useful for sharing, but adds another action and clipboard considerations |
| Open the repository of a clicked link | A separate behavior from the confirmed current-page action |
| Configurable organizations | Needs settings, validation, and persistence |
| Edge Add-ons distribution | Documented post-MVP release path below; requires an authorized publisher and store review |

Avoid adding portal status indicators, GitHub DOM buttons, repository search, or authentication integration unless a later concrete need justifies their complexity.

## Publishing idea: a site-specific Edge Add-on

The [Microsoft Learn Content Metrics extension shared by the user](https://microsoftedge.microsoft.com/addons/detail/microsoft-learn-content-m/ecgmpjcohidknecgamipmidhndgmbajb) is a useful analogy: a tool can serve a narrow website-specific purpose and still have a normal Edge Add-ons listing. This extension serves supported GitHub and repository portal pages rather than Microsoft Learn pages.

The intended path is: finish the MVP, package the compiled extension as a ZIP, submit through an authorized **Microsoft Partner Center** publisher account, complete listing/privacy/certification information, and distribute the approved store link. End users install from Edge Add-ons without Developer mode or a local build.

Confirmed direction and considerations for a later release:

- **Publisher:** official Microsoft-branded publishing is deferred and is not required for the MVP. Choose an authorized publisher account only when ready for a separately approved release.
- **Audience:** use a **Hidden** listing, as confirmed by the user, and share its installation URL directly. Hidden is not employee-only or private, and must still satisfy store review and production-quality policies. Public discovery is not currently planned.
- **Listing:** explain the supported organizations, Overview/JIT choices, reverse navigation, all three entry points, and the portal's sign-in/access prerequisites. JIT navigation is not an access grant. Provide original branding and screenshots that expose no confidential portal or repository information.
- **Privacy and review:** explain user-invoked source/destination tab-URL processing, desktop API permissions and the two exact host grants, no analytics/credentials, and reuse/new navigation. Provide a product-specific privacy policy and reviewer instructions for access-restricted portal behavior.
- **Maintenance:** release new versions through the same listing, with an increased manifest version and store review. Keep unpacked development installation separate from store distribution.

This is release planning only; no account, store submission, or publishing action is authorized by adding it to the documents. Store acceptance is not guaranteed by the Learn example.

See [Publishing to Microsoft Edge Add-ons](IMPLEMENTATION_PLAN.md#publishing-to-microsoft-edge-add-ons) for the concrete steps and release todos, based on Microsoft's [publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).

## Success criteria

The extension is successful when GitHub menus open the exact Overview/JIT URLs, portal actions open the GitHub repository root, toolbar/shortcut defaults are preserved, ineligible sources open nothing, and documented unpacked installation works. Eligibility means the agreed origins, path shapes, and organization allowlist, not independently verified repository existence.

All three target builds and 61 automated cases pass. Native Edge checks confirm two-origin permissions, same-window reuse without navigation/duplicate tabs, GitHub subpage preservation, Overview/JIT separation and other-window exclusion. Native Safari/device/app validation, exhaustive Edge contexts, independently observed manual reload/update, and authenticated JIT access remain unverified. Store distribution remains deferred.

See `IMPLEMENTATION_PLAN.md` for the file layout, implementation steps, dependencies, and acceptance checks.

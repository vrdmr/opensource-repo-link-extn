# GitHub Open Source Portal Extension: Ideas

**Status:** version 0.2.0 is implemented for Microsoft Edge with Overview/JIT and portal-to-GitHub navigation. The user confirmed correct menu placement and working navigation in both directions. Safari on macOS and iPhone is now planned, not implemented; see [SAFARI_IMPLEMENTATION_PLAN.md](SAFARI_IMPLEMENTATION_PLAN.md). See [README.md](README.md) for current build/usage instructions and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#implementation-status) for completed work.

## The useful, small version

While viewing a supported GitHub repository, open its Microsoft open source management portal Overview or JIT page. From a repository's portal page, go back to GitHub:

```text
GitHub: https://github.com/{org}/{repo}/...
Portal: https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}
JIT:    https://repos.opensource.microsoft.com/orgs/{org}/repos/{repo}/jit
Return: https://github.com/{org}/{repo}
```

Working name: **Open Source Portal Link**.

The extension should feel like a browser shortcut, not another application. Edge needs no dashboard, login screen, popup, or GitHub page modifications. The planned iPhone variant uses a small action popup because Safari on iOS does not support extension context menus.

## Current Edge experience

| Entry point | Behavior |
| --- | --- |
| Right-click inside a GitHub repository page | `Microsoft Open Source Portal` submenu with `Open Overview` and `Open JIT Access` |
| Right-click inside a repository's portal page | `Open Repository on GitHub` |
| Toolbar icon | GitHub → portal Overview; portal → GitHub repository root, without a popup |
| Keyboard | `Alt+Shift+O`, or `Option+Shift+O` on macOS; same behavior as the toolbar |

Every successful invocation opens the selected destination in a new focused tab and leaves the original tab open. The original Overview shortcut is unchanged on GitHub; JIT is an explicit right-click choice. The user confirmed the overview MVP works and then authorized JIT and reverse navigation.

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

**Keep permissions narrow.** Edge uses only `activeTab` and `contextMenus`. Safari desktop starts with the same budget; the proposed iPhone popup starts with `activeTab` alone, subject to real grant tests. Read the current URL in response to an explicit action, rather than continuously watching tabs or reading page contents.

**Accept a simple menu filter.** The menus can appear on repository-shaped GitHub/portal pages outside the allowlist. Invocation performs the real validation. Do not promise exact menu visibility for every frame or introduce continuous browsing access to achieve it.

**Fail quietly but visibly.** Unsupported pages open nothing. A `!` badge and toolbar tooltip explain the issue. Pinning the extension makes this feedback easier to find.

**Let the portal own authentication.** The browser opens the portal normally, using the user's existing session or the portal's sign-in flow. The extension never handles credentials or bypasses access checks.

**Do not equate an organization with open-source status.** This is only a URL mapping tool. It does not verify repository existence, visibility, licensing, or portal onboarding.

**Keep the implementation small.** Use TypeScript, a compiler-only build, and a shared pure URL-mapping module. The current `dist/` and native smoke test still target Edge. Planned Safari manifests, entry points and outputs are isolated from Edge; do not duplicate routing logic or reinstate Chrome support.

**Learn extension comparison.** The installed Learn Content Metrics extension's Details page displays `Read your browsing history` and `Display notifications`, with automatic read/change access on the Learn production, dev, PR-dev, and a localhost origin. That is broader than our URL launcher needs. The general site-permissions page contains origin defaults, not a raw list of requested extension permissions. Keep our two-permission design; see the [observed permission comparison](IMPLEMENTATION_PLAN.md#reference-learn-extension-permissions).

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

Version 0.2.0 provides two explicit destinations in the GitHub context submenu:

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

On the portal Overview, JIT, or another repository subpage, `Open Repository on GitHub`, the toolbar, and the existing shortcut all open `https://github.com/{org}/{repo}` in a new focused tab. The same canonical organization spelling and repository case are preserved. Nested paths, query strings, and fragments are discarded.

Reverse navigation does not add host permissions, page injection, or API calls. Portal landing pages, malformed routes, and unsupported organizations remain ineligible.

## Planned: Safari on macOS and iPhone

Keep the working Edge release intact. Desktop Safari aims to retain the menu/toolbar/shortcut experience; iPhone uses a touch-friendly extension popup with Overview/JIT or GitHub buttons based on the source page. Both retain current-page validation, the eight organizations, new-tab behavior, and navigation-only JIT.

Apple compatibility, minimal permissions, source-tab handling, platform-specific builds, native Mac/iPhone checks, and containing-app signing/distribution require separate work. The [Safari implementation plan](SAFARI_IMPLEMENTATION_PLAN.md) records the approach, pending tasks, dependencies, and approval boundaries. No Safari implementation or publication has started.

## Ideas for later, beyond the planned Safari port

| Idea | Why defer it |
| --- | --- |
| Separate JIT shortcut | Useful for frequent JIT users, but needs an additional command and shortcut-conflict testing |
| Preferred Overview/JIT toolbar destination | Needs a settings experience, persistence, and a decision about the shared toolbar/keyboard action |
| Copy the Overview or JIT URL | Useful for sharing, but adds another action and clipboard considerations |
| Open the repository of a clicked link | A separate behavior from the confirmed current-page action |
| Configurable organizations | Needs settings, validation, and persistence |
| Reuse an existing portal tab | Requires inspecting existing tab URLs and revisiting permissions |
| Edge Add-ons distribution | Documented post-MVP release path below; requires an authorized publisher and store review |

Avoid adding portal status indicators, GitHub DOM buttons, repository search, or authentication integration unless a later concrete need justifies their complexity.

## Publishing idea: a site-specific Edge Add-on

The [Microsoft Learn Content Metrics extension shared by the user](https://microsoftedge.microsoft.com/addons/detail/microsoft-learn-content-m/ecgmpjcohidknecgamipmidhndgmbajb) is a useful analogy: a tool can serve a narrow website-specific purpose and still have a normal Edge Add-ons listing. This extension serves supported GitHub and repository portal pages rather than Microsoft Learn pages.

The intended path is: finish the MVP, package the compiled extension as a ZIP, submit through an authorized **Microsoft Partner Center** publisher account, complete listing/privacy/certification information, and distribute the approved store link. End users install from Edge Add-ons without Developer mode or a local build.

Confirmed direction and considerations for a later release:

- **Publisher:** official Microsoft-branded publishing is deferred and is not required for the MVP. Choose an authorized publisher account only when ready for a separately approved release.
- **Audience:** use a **Hidden** listing, as confirmed by the user, and share its installation URL directly. Hidden is not employee-only or private, and must still satisfy store review and production-quality policies. Public discovery is not currently planned.
- **Listing:** explain the supported organizations, Overview/JIT choices, reverse navigation, all three entry points, and the portal's sign-in/access prerequisites. JIT navigation is not an access grant. Provide original branding and screenshots that expose no confidential portal or repository information.
- **Privacy and review:** explain user-invoked URL processing, the two permissions, no analytics or credential handling, and the destination navigation. Provide a product-specific privacy policy and reviewer instructions for access-restricted portal behavior.
- **Maintenance:** release new versions through the same listing, with an increased manifest version and store review. Keep unpacked development installation separate from store distribution.

This is release planning only; no account, store submission, or publishing action is authorized by adding it to the documents. Store acceptance is not guaranteed by the Learn example.

See [Publishing to Microsoft Edge Add-ons](IMPLEMENTATION_PLAN.md#publishing-to-microsoft-edge-add-ons) for the concrete steps and release todos, based on Microsoft's [publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).

## Success criteria

The extension is successful when GitHub menus open the exact Overview/JIT URLs, portal actions open the GitHub repository root, toolbar/shortcut defaults are preserved, ineligible sources open nothing, and documented unpacked installation works. Eligibility means the agreed origins, path shapes, and organization allowlist, not independently verified repository existence.

Version 0.2.0 passes the strict build, 23 automated cases, and expanded native headless Edge checks. The user confirmed correct menu placement and working navigation in both directions. Exhaustive context visibility, independently observed manual reload/update, and authenticated JIT access remain unverified; the implementation plan records these limits. Hidden store distribution remains deferred.

See `IMPLEMENTATION_PLAN.md` for the file layout, implementation steps, dependencies, and acceptance checks.

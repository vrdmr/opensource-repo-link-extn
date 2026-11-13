import assert from "node:assert/strict";
import { test } from "node:test";
import { toGitHubUrl, toPortalUrl } from "../dist/repo-url.js";

test("maps the documented repository examples to their exact overview URLs", () => {
  for (const [owner, name] of [
    ["Azure", "azure-functions-agents-runtime"],
    ["Azure-Samples", "Durable-Task-Scheduler"],
    ["microsoft", "vscode"],
    ["MicrosoftDocs", "azure-docs"],
    ["dotnet", "runtime"],
  ]) {
    assert.equal(
      toPortalUrl(`https://github.com/${owner}/${name}`),
      `https://repos.opensource.microsoft.com/orgs/${owner}/repos/${name}`,
    );
  }
});

test("canonicalizes all allowed owners and preserves repository spelling", () => {
  for (const owner of [
    "Azure", "Azure-Samples", "microsoft", "MicrosoftDocs",
    "dotnet", "microsoftfeedback", "microsoftarchive", "microsofthackathons",
  ]) {
    for (const name of ["Sample_repo.v1", ".github", "project.git", "not-a-real-repository"]) {
      assert.equal(
        toPortalUrl(`https://github.com/${owner.toUpperCase()}/${name}`),
        `https://repos.opensource.microsoft.com/orgs/${owner}/repos/${name}`,
      );
    }
  }
});

test("ignores nested paths, query strings, and fragments", () => {
  for (const suffix of [
    "", "/", "/issues/42", "/pull/17/files", "/blob/main/README.md",
    "/tree/feature/nested", "/actions/runs/123", "/releases/tag/v1", "/settings",
    "/issues?q=is%3Aopen#fragment", "?tab=readme#readme",
  ]) {
    assert.equal(
      toPortalUrl(`https://github.com/Azure-Samples/Durable-Task-Scheduler${suffix}`),
      "https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Durable-Task-Scheduler",
    );
  }
});

test("decodes the two extracted segments once without changing their meaning", () => {
  assert.equal(
    toPortalUrl("https://github.com/Azure%2DSamples/Sample%5Frepo.v1"),
    "https://repos.opensource.microsoft.com/orgs/Azure-Samples/repos/Sample_repo.v1",
  );
});

test("rejects ineligible origins, missing source URLs, and non-repository paths", () => {
  for (const input of [
    undefined, "", "not a URL", "/Azure/repo",
    "http://github.com/Azure/repo",
    "https://github.com:444/Azure/repo",
    "https://github.com.example.com/Azure/repo",
    "https://www.github.com/Azure/repo",
    "https://raw.githubusercontent.com/Azure/repo/main/README.md",
    "https://ghe.example.com/Azure/repo",
    "https://user:password@github.com/Azure/repo",
    "https://github.com@other.example/Azure/repo",
    "https://github.com",
    "https://github.com/Azure",
    "https://github.com/Azure/",
    "https://github.com//repo",
    "https://github.com/Azure//issues",
    "https://github.com/other/repo",
    "https://github.com/micrsoftarchive/repo",
    "https://github.com/orgs/Azure/repositories",
    "https://github.com/settings/profile",
    "edge://extensions",
  ]) {
    assert.equal(toPortalUrl(input), null, input);
    assert.equal(toPortalUrl(input, "jit"), null, input);
  }
});

test("rejects malformed or unsafe owner/repository segments without throwing", () => {
  for (const path of [
    "Azure/repo%2Fother", "Azure/repo%5Cother", "Azure/repo%252Fother",
    "Azure%2Fother/repo", "Azure%5Cother/repo", "Azure/%",
    "Azure/%FF", "%ZZ/repo", "Azure/repo%00", "Azure/repo%20name",
    "Azure/%3Fquery", "Azure/%23fragment", "Azure/.", "Azure/..",
  ]) {
    assert.equal(toPortalUrl(`https://github.com/${path}`), null, path);
    assert.equal(toPortalUrl(`https://github.com/${path}`, "jit"), null, path);
  }
});

test("JIT adds exactly /jit to the validated repository overview", () => {
  for (const owner of [
    "Azure", "Azure-Samples", "microsoft", "MicrosoftDocs",
    "dotnet", "microsoftfeedback", "microsoftarchive", "microsofthackathons",
  ]) {
    for (const suffix of ["", "/", "/issues/42", "/jit", "?query=1#fragment"]) {
      assert.equal(
        toPortalUrl(`https://github.com/${owner.toUpperCase()}/Sample%5Frepo.v1${suffix}`, "jit"),
        `https://repos.opensource.microsoft.com/orgs/${owner}/repos/Sample_repo.v1/jit`,
      );
    }
  }
});

test("portal overview, JIT, and nested pages map to the GitHub repository root", () => {
  for (const owner of [
    "Azure", "Azure-Samples", "microsoft", "MicrosoftDocs",
    "dotnet", "microsoftfeedback", "microsoftarchive", "microsofthackathons",
  ]) {
    for (const name of ["Sample_repo.v1", ".github", "project.git", "not-a-real-repository"]) {
      for (const suffix of ["", "/", "/jit", "/jit/access?query=1#fragment"]) {
        assert.equal(
          toGitHubUrl(`https://repos.opensource.microsoft.com/orgs/${owner.toUpperCase()}/repos/${name}${suffix}`),
          `https://github.com/${owner}/${name}`,
        );
      }
    }
  }
  assert.equal(
    toGitHubUrl("https://repos.opensource.microsoft.com/orgs/Azure%2DSamples/repos/Sample%5Frepo.v1/jit"),
    "https://github.com/Azure-Samples/Sample_repo.v1",
  );
});

test("reverse navigation rejects unrelated origins, portal routes, and organizations", () => {
  for (const input of [
    undefined, "", "not a URL", "https://github.com/Azure/repo",
    "http://repos.opensource.microsoft.com/orgs/Azure/repos/repo",
    "https://repos.opensource.microsoft.com:444/orgs/Azure/repos/repo",
    "https://repos.opensource.microsoft.com.example.com/orgs/Azure/repos/repo",
    "https://user:password@repos.opensource.microsoft.com/orgs/Azure/repos/repo",
    "https://repos.opensource.microsoft.com",
    "https://repos.opensource.microsoft.com/orgs/Azure",
    "https://repos.opensource.microsoft.com/orgs/Azure/repos",
    "https://repos.opensource.microsoft.com/orgs/Azure/repos/",
    "https://repos.opensource.microsoft.com/orgs//repos/repo",
    "https://repos.opensource.microsoft.com/orgs/Azure/repos//jit",
    "https://repos.opensource.microsoft.com/orgs/other/repos/repo",
    "https://repos.opensource.microsoft.com/Azure/repo",
    "https://repos.opensource.microsoft.com/users/Azure/repos/repo",
    "https://repos.opensource.microsoft.com/orgs/Azure/projects/repo",
  ]) {
    assert.equal(toGitHubUrl(input), null, input);
  }
  assert.equal(toPortalUrl("https://repos.opensource.microsoft.com/orgs/Azure/repos/repo", "jit"), null);
});

test("reverse navigation rejects malformed or unsafe owner/repository segments", () => {
  for (const [owner, name] of [
    ["Azure", "repo%2Fother"], ["Azure", "repo%5Cother"], ["Azure", "repo%252Fother"],
    ["Azure%2Fother", "repo"], ["Azure%5Cother", "repo"], ["%ZZ", "repo"],
    ["Azure", "%"], ["Azure", "%FF"], ["Azure", "repo%00"], ["Azure", "repo%20name"],
    ["Azure", "%3Fquery"], ["Azure", "%23fragment"], ["Azure", "."], ["Azure", ".."],
  ]) {
    assert.equal(
      toGitHubUrl(`https://repos.opensource.microsoft.com/orgs/${owner}/repos/${name}`),
      null,
    );
  }
});

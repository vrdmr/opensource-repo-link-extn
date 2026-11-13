const organizations = new Map(
  [
    "Azure",
    "Azure-Samples",
    "microsoft",
    "MicrosoftDocs",
    "dotnet",
    "microsoftfeedback",
    "microsoftarchive",
    "microsofthackathons",
  ].map((organization) => [organization.toLowerCase(), organization]),
);

function repositoryFromUrl(
  input: string | undefined,
  source: "github" | "portal",
): { organization: string; repository: string } | null {
  if (!input) {
    return null;
  }

  try {
    const url = new URL(input);
    if (
      url.origin !== (source === "github"
        ? "https://github.com"
        : "https://repos.opensource.microsoft.com") ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const segments = url.pathname.split("/");
    if (source === "portal" && (segments[1] !== "orgs" || segments[3] !== "repos")) {
      return null;
    }

    const owner = segments[source === "github" ? 1 : 2];
    const name = segments[source === "github" ? 2 : 4];
    if (!owner || !name) {
      return null;
    }

    const organization = organizations.get(decodeURIComponent(owner).toLowerCase());
    const repository = decodeURIComponent(name);
    if (!organization || !/^[A-Za-z0-9._-]+$/.test(repository)) {
      return null;
    }

    return { organization, repository };
  } catch {
    return null;
  }
}

export function toPortalUrl(
  input: string | undefined,
  destination: "overview" | "jit" = "overview",
): string | null {
  const repository = repositoryFromUrl(input, "github");
  if (!repository) {
    return null;
  }

  const { organization, repository: name } = repository;
  const overview = `https://repos.opensource.microsoft.com/orgs/${encodeURIComponent(organization)}/repos/${encodeURIComponent(name)}`;
  return destination === "jit" ? `${overview}/jit` : overview;
}

export function toGitHubUrl(input: string | undefined): string | null {
  const repository = repositoryFromUrl(input, "portal");
  if (!repository) {
    return null;
  }

  const { organization, repository: name } = repository;
  return `https://github.com/${encodeURIComponent(organization)}/${encodeURIComponent(name)}`;
}

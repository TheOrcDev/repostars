const UNSAFE_FILENAME_CHARS = /[^A-Za-z0-9_.-]+/g;

/** `repostars-owner-repo_owner2-repo2.png`, safe for every filesystem. */
export function exportFilename(repoNames: string[]): string {
  const stem = repoNames
    .map((name) => name.replace("/", "-").replace(UNSAFE_FILENAME_CHARS, ""))
    .filter(Boolean)
    .join("_");
  return `repostars-${stem || "chart"}.png`;
}

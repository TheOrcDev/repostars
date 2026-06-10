import { GitHubStars } from "@/components/github-stars";
import { getRepoStars } from "@/lib/github";

const REPO = "TheOrcDev/repostars";

export async function GitHubStarsButton() {
  const stargazersCount = await getRepoStars(REPO);

  return <GitHubStars repo={REPO} stargazersCount={stargazersCount} />;
}

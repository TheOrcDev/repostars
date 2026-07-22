import type { RepoInfo, StarDataPoint } from "@/lib/github";
import { getRepoInfo, getStarHistoryResult } from "@/lib/github";

export interface RepoData {
  estimated: boolean;
  history: StarDataPoint[];
  info: RepoInfo;
}

// Route handlers cache successful responses with Cache-Control headers. Keep
// GitHub errors outside a "use cache" boundary so clients get readable JSON.
export async function getRepoData(
  owner: string,
  repo: string
): Promise<RepoData> {
  const info = await getRepoInfo(owner, repo);
  const { estimated, history } = await getStarHistoryResult(owner, repo, info);

  return { estimated, info, history };
}

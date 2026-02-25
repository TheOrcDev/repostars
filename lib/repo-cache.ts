import { cacheLife, cacheTag } from "next/cache";
import { getRepoInfo, getStarHistory } from "@/lib/github";
import type { RepoInfo, StarDataPoint } from "@/lib/github";

export interface RepoData {
  info: RepoInfo;
  history: StarDataPoint[];
}

export async function getRepoDataCached(
  owner: string,
  repo: string
): Promise<RepoData> {
  "use cache";

  cacheTag(`repo:${owner}/${repo}`);
  cacheLife("hours");

  const info = await getRepoInfo(owner, repo);
  const history = await getStarHistory(owner, repo, info);

  return { info, history };
}

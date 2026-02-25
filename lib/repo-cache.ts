import { cacheLife, cacheTag } from "next/cache";
import { getRepoInfo, getStarHistory } from "@/lib/github";
import type { RepoInfo, StarDataPoint } from "@/lib/github";

export interface RepoData {
  info: RepoInfo;
  history: StarDataPoint[];
}

const CACHE_VERSION = "v2";

export async function getRepoDataCached(
  owner: string,
  repo: string,
  version: string = CACHE_VERSION
): Promise<RepoData> {
  "use cache";

  cacheTag(`repo:${owner}/${repo}:${version}`);
  cacheLife("hours");

  const info = await getRepoInfo(owner, repo);
  const history = await getStarHistory(owner, repo, info);

  return { info, history };
}

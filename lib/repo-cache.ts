import { cacheLife, cacheTag } from "next/cache";
import type { RepoInfo, StarDataPoint } from "@/lib/github";
import { getRepoInfo, getStarHistory } from "@/lib/github";

export interface RepoData {
  history: StarDataPoint[];
  info: RepoInfo;
}

const CACHE_VERSION = "v3";

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

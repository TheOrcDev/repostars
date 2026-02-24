import { unstable_cache } from "next/cache";
import { getRepoInfo, getStarHistory } from "./github";
import type { StarDataPoint, RepoInfo } from "./github";

interface CachedStarData {
  info: RepoInfo;
  history: StarDataPoint[];
}

// Cache star data for 24 hours
export const getCachedStarData = unstable_cache(
  async (owner: string, repo: string): Promise<CachedStarData> => {
    const info = await getRepoInfo(owner, repo);
    const history = await getStarHistory(owner, repo, info);
    return { info, history };
  },
  ["star-data"],
  { revalidate: 86400 } // 24h
);

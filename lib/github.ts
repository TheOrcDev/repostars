export interface StarDataPoint {
  date: string; // ISO date
  stars: number;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  description: string;
  stars: number;
  language: string | null;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const IS_AUTHENTICATED = Boolean(GITHUB_TOKEN);

function headers() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.star+json",
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

function repoHeaders() {
  const h: Record<string, string> = {};
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

export async function getRepoInfo(
  owner: string,
  repo: string
): Promise<RepoInfo> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: repoHeaders(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      throw new Error("GitHub API rate limit exceeded. Try again later.");
    }
    throw new Error(`Repo not found: ${owner}/${repo}`);
  }
  const data = await res.json();
  return {
    owner,
    repo,
    fullName: data.full_name,
    description: data.description || "",
    stars: data.stargazers_count,
    language: data.language,
  };
}

/**
 * Fetch star history with smart sampling.
 * Accepts pre-fetched info to avoid double API call.
 */
export async function getStarHistory(
  owner: string,
  repo: string,
  info?: RepoInfo
): Promise<StarDataPoint[]> {
  if (!info) info = await getRepoInfo(owner, repo);
  const totalStars = info.stars;

  if (totalStars === 0) return [];

  const totalPages = Math.ceil(totalStars / 100);

  // Adjust sample count based on auth (unauthenticated = 60 req/hr)
  const maxSample = IS_AUTHENTICATED ? 80 : 30;

  let pagesToFetch: number[];

  if (totalPages <= maxSample) {
    pagesToFetch = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    pagesToFetch = Array.from({ length: maxSample }, (_, i) =>
      Math.max(1, Math.round(((i + 1) / maxSample) * totalPages))
    );
    pagesToFetch = [...new Set(pagesToFetch)];
  }

  const results: StarDataPoint[] = [];
  const batchSize = IS_AUTHENTICATED ? 10 : 5;

  for (let i = 0; i < pagesToFetch.length; i += batchSize) {
    const batch = pagesToFetch.slice(i, i + batchSize);
    const responses = await Promise.all(
      batch.map(async (page) => {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`,
          { headers: headers(), next: { revalidate: 21600 } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.map(
          (s: { starred_at: string }, idx: number) =>
            ({
              date: s.starred_at.split("T")[0],
              stars: (page - 1) * 100 + idx + 1,
            }) as StarDataPoint
        );
      })
    );
    results.push(...responses.flat());
  }

  // Sort and deduplicate: keep highest star count per date
  const sorted = results.sort((a, b) => a.stars - b.stars);
  const byDate = new Map<string, StarDataPoint>();
  for (const point of sorted) {
    byDate.set(point.date, point);
  }
  const anchors = Array.from(byDate.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (anchors.length < 2) return anchors;

  // Compute date range
  const startMs = new Date(anchors[0].date).getTime();
  const endMs = new Date(anchors[anchors.length - 1].date).getTime();
  const rangeMs = endMs - startMs;

  // Pick bin size based on range
  const dayMs = 86400000;
  let binMs: number;
  const rangeDays = rangeMs / dayMs;
  if (rangeDays <= 90) binMs = dayMs;
  else if (rangeDays <= 365) binMs = dayMs * 7;
  else if (rangeDays <= 365 * 3) binMs = dayMs * 14;
  else binMs = dayMs * 30;

  // Interpolate between anchor points
  const interpolated: StarDataPoint[] = [];
  for (let ms = startMs; ms <= endMs; ms += binMs) {
    const date = new Date(ms).toISOString().split("T")[0];

    // Binary search for surrounding anchors
    let lo = 0, hi = anchors.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (new Date(anchors[mid].date).getTime() <= ms) lo = mid;
      else hi = mid;
    }

    const loMs = new Date(anchors[lo].date).getTime();
    const hiMs = new Date(anchors[hi].date).getTime();
    const t = hiMs === loMs ? 1 : (ms - loMs) / (hiMs - loMs);
    const stars = Math.round(anchors[lo].stars + t * (anchors[hi].stars - anchors[lo].stars));

    interpolated.push({ date, stars });
  }

  // Always include the last anchor
  const lastAnchor = anchors[anchors.length - 1];
  if (interpolated[interpolated.length - 1]?.date !== lastAnchor.date) {
    interpolated.push(lastAnchor);
  }

  return interpolated;
}

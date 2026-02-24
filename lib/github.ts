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

function headers() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.star+json",
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

export async function getRepoInfo(
  owner: string,
  repo: string
): Promise<RepoInfo> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: GITHUB_TOKEN
      ? { Authorization: `Bearer ${GITHUB_TOKEN}` }
      : undefined,
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Repo not found: ${owner}/${repo}`);
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
 * Fetch star history with smart sampling for large repos.
 * GitHub returns 100 stargazers per page with timestamps.
 */
export async function getStarHistory(
  owner: string,
  repo: string
): Promise<StarDataPoint[]> {
  const info = await getRepoInfo(owner, repo);
  const totalStars = info.stars;

  if (totalStars === 0) return [];

  const totalPages = Math.ceil(totalStars / 100);

  // For small repos, fetch all pages
  // For large repos, sample evenly across the full range
  let pagesToFetch: number[];

  if (totalPages <= 80) {
    // Fetch all pages (up to 8K stars)
    pagesToFetch = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    // Sample ~80 pages evenly distributed for smooth curves
    const sampleCount = 80;
    pagesToFetch = Array.from({ length: sampleCount }, (_, i) =>
      Math.max(1, Math.round(((i + 1) / sampleCount) * totalPages))
    );
    // Deduplicate
    pagesToFetch = [...new Set(pagesToFetch)];
  }

  const results: StarDataPoint[] = [];

  // Fetch in batches of 10 to avoid rate limiting
  for (let i = 0; i < pagesToFetch.length; i += 10) {
    const batch = pagesToFetch.slice(i, i + 10);
    const responses = await Promise.all(
      batch.map(async (page) => {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`,
          { headers: headers(), next: { revalidate: 21600 } } // 6h cache
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

  // Sort sampled points by star count (our ground truth)
  const sorted = results.sort((a, b) => a.stars - b.stars);

  // Deduplicate: keep highest star count per date
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
  if (rangeDays <= 90) binMs = dayMs;             // daily
  else if (rangeDays <= 365) binMs = dayMs * 7;    // weekly
  else if (rangeDays <= 365 * 3) binMs = dayMs * 14; // biweekly
  else binMs = dayMs * 30;                          // monthly

  // Interpolate: for each bin date, lerp between anchor points
  const interpolated: StarDataPoint[] = [];
  for (let ms = startMs; ms <= endMs; ms += binMs) {
    const date = new Date(ms).toISOString().split("T")[0];

    // Find surrounding anchors
    let lo = anchors[0];
    let hi = anchors[anchors.length - 1];
    for (let i = 0; i < anchors.length - 1; i++) {
      const aMs = new Date(anchors[i].date).getTime();
      const bMs = new Date(anchors[i + 1].date).getTime();
      if (aMs <= ms && bMs >= ms) {
        lo = anchors[i];
        hi = anchors[i + 1];
        break;
      }
    }

    const loMs = new Date(lo.date).getTime();
    const hiMs = new Date(hi.date).getTime();
    const t = hiMs === loMs ? 1 : (ms - loMs) / (hiMs - loMs);
    const stars = Math.round(lo.stars + t * (hi.stars - lo.stars));

    interpolated.push({ date, stars });
  }

  // Always include the last anchor
  const lastAnchor = anchors[anchors.length - 1];
  if (interpolated[interpolated.length - 1]?.date !== lastAnchor.date) {
    interpolated.push(lastAnchor);
  }

  return interpolated;
}

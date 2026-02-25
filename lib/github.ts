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

  // GitHub caps stargazer API at 400 pages (40,000 stars)
  const MAX_GITHUB_PAGES = 400;
  const totalPages = Math.ceil(totalStars / 100);
  const fetchablePages = Math.min(totalPages, MAX_GITHUB_PAGES);

  // Adjust sample count — keep it fast enough for Vercel's timeout
  const maxSample = IS_AUTHENTICATED ? 40 : 20;

  let pagesToFetch: number[];

  if (fetchablePages <= maxSample) {
    pagesToFetch = Array.from({ length: fetchablePages }, (_, i) => i + 1);
  } else {
    pagesToFetch = Array.from({ length: maxSample }, (_, i) =>
      Math.max(1, Math.round(((i + 1) / maxSample) * fetchablePages))
    );
    pagesToFetch = [...new Set(pagesToFetch)];
  }

  // Fire all requests at once — no sequential batching
  const responses = await Promise.all(
    pagesToFetch.map(async (page) => {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`,
        { headers: headers() }
      );
      if (res.status === 403 || res.status === 429) return { rateLimited: true, data: [] };
      if (!res.ok) return { rateLimited: false, data: [] };
      const data = await res.json();
      return {
        rateLimited: false,
        data: data.map(
          (s: { starred_at: string }, idx: number) =>
            ({
              date: s.starred_at.split("T")[0],
              stars: (page - 1) * 100 + idx + 1,
            }) as StarDataPoint
        ),
      };
    })
  );

  const results: StarDataPoint[] = [];
  let rateLimited = false;
  for (const r of responses) {
    if (r.rateLimited) rateLimited = true;
    results.push(...r.data);
  }

  if (results.length === 0 && rateLimited) {
    throw new Error("GitHub API rate limit exceeded. Try again later or add a GITHUB_TOKEN.");
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

  // For repos > 40k stars, we only have data up to ~40k from the API.
  // Keep the real data shape, then interpolate from the last known point
  // to today's actual star count with additional data points.
  if (totalStars > MAX_GITHUB_PAGES * 100 && interpolated.length > 0) {
    const lastPoint = interpolated[interpolated.length - 1];
    const lastMs = new Date(lastPoint.date).getTime();
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const today = new Date(todayMs).toISOString().split("T")[0];

    if (lastPoint.stars < totalStars && lastPoint.date !== today) {
      // Add synthetic points from last real data to today.
      // Keep this linear + monotonic to avoid long flat tails on large repos.
      const gapMs = todayMs - lastMs;
      const gapDays = gapMs / dayMs;
      const gapBin = gapDays <= 180 ? dayMs * 7 : dayMs * 14;
      const starGap = totalStars - lastPoint.stars;

      const syntheticDates: number[] = [];
      for (let ms = lastMs + gapBin; ms < todayMs; ms += gapBin) {
        syntheticDates.push(ms);
      }

      const steps = syntheticDates.length;
      let prev = lastPoint.stars;

      syntheticDates.forEach((ms, idx) => {
        const t = (idx + 1) / (steps + 1); // linear 0..1 (excluding endpoints)
        const raw = lastPoint.stars + t * starGap;
        const minRemainingStep = Math.max(1, Math.floor((totalStars - prev) / (steps - idx + 1)));
        const next = Math.min(totalStars - 1, Math.max(Math.floor(raw), prev + minRemainingStep));
        prev = next;

        const date = new Date(ms).toISOString().split("T")[0];
        interpolated.push({ date, stars: next });
      });

      // Final point at today with actual star count
      if (prev >= totalStars) {
        // Ensure strictly increasing endpoint
        prev = totalStars - 1;
      }
      interpolated.push({ date: today, stars: totalStars });
    }
  }

  return interpolated;
}

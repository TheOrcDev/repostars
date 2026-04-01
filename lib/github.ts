export interface StarDataPoint {
  date: string; // ISO date
  stars: number;
}

export interface RepoInfo {
  description: string;
  fullName: string;
  language: string | null;
  owner: string;
  repo: string;
  stars: number;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const IS_AUTHENTICATED = Boolean(GITHUB_TOKEN);

function headers() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.star+json",
  };
  if (GITHUB_TOKEN) {
    h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return h;
}

function repoHeaders() {
  const h: Record<string, string> = {};
  if (GITHUB_TOKEN) {
    h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return h;
}

function toIsoDate(ms: number) {
  return new Date(ms).toISOString().split("T")[0];
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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: intentionally consolidated data pipeline
export async function getStarHistory(
  owner: string,
  repo: string,
  info?: RepoInfo
): Promise<StarDataPoint[]> {
  const resolvedInfo = info ?? (await getRepoInfo(owner, repo));
  const totalStars = resolvedInfo.stars;

  if (totalStars === 0) {
    return [];
  }

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
      if (res.status === 403 || res.status === 429) {
        return { rateLimited: true, data: [] };
      }
      if (!res.ok) {
        return { rateLimited: false, data: [] };
      }
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
    if (r.rateLimited) {
      rateLimited = true;
    }
    results.push(...r.data);
  }

  if (results.length === 0 && rateLimited) {
    throw new Error(
      "GitHub API rate limit exceeded. Try again later or add a GITHUB_TOKEN."
    );
  }

  // Sort and deduplicate: keep highest star count per date
  const sorted = results.sort((a, b) => a.stars - b.stars);
  const byDate = new Map<string, StarDataPoint>();
  for (const point of sorted) {
    byDate.set(point.date, point);
  }
  const dedupedAnchors = Array.from(byDate.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (dedupedAnchors.length === 0) {
    return [];
  }

  const dayMs = 86_400_000;
  const firstAnchor = dedupedAnchors[0];
  const firstAnchorMs = new Date(firstAnchor.date).getTime();
  const anchors: StarDataPoint[] = [
    {
      date: toIsoDate(Math.max(0, firstAnchorMs - dayMs)),
      stars: 0,
    },
    ...dedupedAnchors,
  ];

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const today = toIsoDate(todayMs);

  if (anchors.length === 2) {
    const singleDayHistory = [...anchors];
    if (singleDayHistory.at(-1)?.date !== today) {
      singleDayHistory.push({ date: today, stars: totalStars });
    }
    return singleDayHistory;
  }

  // Compute date range
  const startMs = new Date(anchors[0].date).getTime();
  const endAnchor = anchors.at(-1);
  if (!endAnchor) {
    return anchors;
  }
  const endMs = new Date(endAnchor.date).getTime();
  const rangeMs = endMs - startMs;

  // Pick bin size based on range
  let binMs: number;
  const rangeDays = rangeMs / dayMs;
  if (rangeDays <= 90) {
    binMs = dayMs;
  } else if (rangeDays <= 365) {
    binMs = dayMs * 7;
  } else if (rangeDays <= 365 * 3) {
    binMs = dayMs * 14;
  } else {
    binMs = dayMs * 30;
  }

  // Sample as a staircase so growth stays truthful and visually punchy.
  const interpolated: StarDataPoint[] = [];
  let anchorIndex = 0;
  for (let ms = startMs; ms <= endMs; ms += binMs) {
    while (
      anchorIndex + 1 < anchors.length &&
      new Date(anchors[anchorIndex + 1].date).getTime() <= ms
    ) {
      anchorIndex += 1;
    }

    interpolated.push({
      date: toIsoDate(ms),
      stars: anchors[anchorIndex].stars,
    });
  }

  // Always include the last anchor
  const lastAnchor = anchors.at(-1);
  if (lastAnchor && interpolated.at(-1)?.date !== lastAnchor.date) {
    interpolated.push(lastAnchor);
  }

  // For repos > 40k stars, we only have data up to ~40k from the API.
  // Keep the real data shape, then interpolate from the last known point
  // to today's actual star count with additional data points.
  if (totalStars > MAX_GITHUB_PAGES * 100 && interpolated.length > 0) {
    const lastPoint = interpolated.at(-1);
    if (!lastPoint) {
      return interpolated;
    }
    const lastMs = new Date(lastPoint.date).getTime();

    if (lastPoint.stars < totalStars && lastPoint.date !== today) {
      // Add synthetic points from last real data to today.
      // Use smoothstep curve (S-shape) + monotonic growth to avoid flat or too-straight tails.
      const gapMs = todayMs - lastMs;
      const gapDays = gapMs / dayMs;
      const starGap = totalStars - lastPoint.stars;

      // Keep enough points so the tail has visible curvature.
      const steps = Math.max(12, Math.min(52, Math.floor(gapDays / 7)));
      let prev = lastPoint.stars;

      for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1); // 0..1 (excluding endpoints)
        // Smoothstep: 3t^2 - 2t^3 (gentle curve, no harsh plateau)
        const eased = t * t * (3 - 2 * t);
        const raw = lastPoint.stars + eased * starGap;

        const ms = lastMs + t * gapMs;
        const minRemainingStep = Math.max(
          1,
          Math.floor((totalStars - prev) / (steps - i + 2))
        );
        const next = Math.min(
          totalStars - 1,
          Math.max(Math.floor(raw), prev + minRemainingStep)
        );
        prev = next;

        const date = toIsoDate(ms);
        interpolated.push({ date, stars: next });
      }

      // Final point at today with actual star count
      interpolated.push({ date: today, stars: totalStars });
    }
  }

  const finalPoint = interpolated.at(-1);
  if (
    finalPoint &&
    finalPoint.date !== today &&
    totalStars <= MAX_GITHUB_PAGES * 100
  ) {
    interpolated.push({ date: today, stars: totalStars });
  }

  return interpolated;
}

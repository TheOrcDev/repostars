import { fetchPublicStarHistory } from "@/lib/star-history-providers";

export interface StarDataPoint {
  date: string; // ISO date or timestamp
  stars: number;
}

export interface StarHistoryResult {
  estimated: boolean;
  history: StarDataPoint[];
}

export interface RepoInfo {
  createdAt: string;
  description: string;
  fullName: string;
  id: number;
  language: string | null;
  owner: string;
  repo: string;
  stars: number;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const IS_AUTHENTICATED = Boolean(GITHUB_TOKEN);
const RAW_HISTORY_MAX_POINTS = 750;

let warnedMissingToken = false;
function warnMissingToken() {
  if (warnedMissingToken) {
    return;
  }
  warnedMissingToken = true;
  console.warn(
    "GITHUB_TOKEN is not set. GitHub requires authentication for stargazer history, so charts fall back to estimated public data."
  );
}

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

/**
 * Cached stargazer count for a single repo (owner/repo). Returns 0 on any
 * failure so a transient API hiccup never breaks the header.
 */
export async function getRepoStars(repo: string): Promise<number> {
  "use cache";

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: repoHeaders(),
    });
    if (!res.ok) {
      return 0;
    }
    const data = await res.json();
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : 0;
  } catch {
    return 0;
  }
}

function toIsoDate(ms: number) {
  return new Date(ms).toISOString().split("T")[0];
}

interface RestStargazerPage {
  authBlocked: boolean;
  data: StarDataPoint[];
  rateLimited: boolean;
}

async function fetchRestStargazerPage(
  owner: string,
  repo: string,
  page: number
): Promise<RestStargazerPage> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`,
    { headers: headers() }
  );
  if (!res.ok) {
    const body = await res.text();
    const rateLimited =
      res.status === 429 || body.toLowerCase().includes("rate limit");
    const authBlocked =
      res.status === 401 || (res.status === 403 && !rateLimited);
    if (authBlocked && IS_AUTHENTICATED) {
      console.warn(
        `GitHub rejected the stargazers request (HTTP ${res.status}). GITHUB_TOKEN is likely invalid, expired, or missing repo read access; charts fall back to estimated public data.`
      );
    }
    return {
      authBlocked,
      data: [],
      rateLimited,
    };
  }

  const data = await res.json();
  return {
    authBlocked: false,
    data: data.map(
      (s: { starred_at: string }, idx: number) =>
        ({
          date: s.starred_at,
          stars: (page - 1) * 100 + idx + 1,
        }) as StarDataPoint
    ),
    rateLimited: false,
  };
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
    createdAt: data.created_at,
    fullName: data.full_name,
    id: data.id,
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
export async function getStarHistoryResult(
  owner: string,
  repo: string,
  info?: RepoInfo
): Promise<StarHistoryResult> {
  const resolvedInfo = info ?? (await getRepoInfo(owner, repo));
  const totalStars = resolvedInfo.stars;
  let estimated = false;
  const result = (history: StarDataPoint[]): StarHistoryResult => ({
    estimated,
    history,
  });

  if (totalStars === 0) {
    return result([]);
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

  // GitHub now requires authentication on the stargazers endpoint, so an
  // unauthenticated probe is a guaranteed 401 — skip straight to estimation.
  if (!IS_AUTHENTICATED) {
    warnMissingToken();
  }

  const probePage = pagesToFetch[0];
  const probe =
    IS_AUTHENTICATED && probePage
      ? await fetchRestStargazerPage(owner, repo, probePage)
      : null;

  let results: StarDataPoint[];
  let rateLimited = Boolean(probe?.rateLimited);

  const accessRestricted =
    !IS_AUTHENTICATED ||
    probe?.authBlocked ||
    (probe !== null && probe.data.length === 0 && !probe.rateLimited);

  if (accessRestricted) {
    estimated = true;
    const [canonicalOwner = owner, canonicalRepo = repo] =
      resolvedInfo.fullName.split("/");
    results = await fetchPublicStarHistory({
      createdAt: resolvedInfo.createdAt,
      owner: canonicalOwner,
      repoId: resolvedInfo.id,
      repo: canonicalRepo,
      requestedName: `${owner}/${repo}`,
      totalStars,
    });
  } else {
    const responses = await Promise.all(
      pagesToFetch
        .filter((page) => page !== probePage)
        .map((page) => fetchRestStargazerPage(owner, repo, page))
    );

    results = probe?.data ?? [];
    for (const r of responses) {
      if (r.rateLimited) {
        rateLimited = true;
      }
      results.push(...r.data);
    }
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
    return result([]);
  }

  const dayMs = 86_400_000;
  const firstAnchor = dedupedAnchors[0];
  const firstAnchorMs = new Date(firstAnchor.date).getTime();
  const anchors: StarDataPoint[] =
    firstAnchor.stars === 0
      ? dedupedAnchors
      : [
          {
            date: toIsoDate(Math.max(0, firstAnchorMs - dayMs)),
            stars: 0,
          },
          ...dedupedAnchors,
        ];

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const today = toIsoDate(todayMs);
  const finalAnchor = anchors.at(-1);

  if (
    finalAnchor?.stars === totalStars &&
    anchors.length <= RAW_HISTORY_MAX_POINTS
  ) {
    return result(anchors);
  }

  if (anchors.length === 2 && anchors[1]?.stars === totalStars) {
    const singleDayHistory = [...anchors];
    if (singleDayHistory.at(-1)?.date !== today) {
      singleDayHistory.push({ date: today, stars: totalStars });
    }
    return result(singleDayHistory);
  }

  // Compute date range
  const startMs = new Date(anchors[0].date).getTime();
  const endAnchor = anchors.at(-1);
  if (!endAnchor) {
    return result(anchors);
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

  // Keep the real data shape, then interpolate from the last known point to
  // today's actual star count when the upstream API only returned a prefix.
  if (interpolated.length > 0) {
    const lastPoint = interpolated.at(-1);
    if (!lastPoint) {
      return result(interpolated);
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
    finalPoint.stars === totalStars
  ) {
    interpolated.push({ date: today, stars: totalStars });
  }

  return result(interpolated);
}

export async function getStarHistory(
  owner: string,
  repo: string,
  info?: RepoInfo
): Promise<StarDataPoint[]> {
  const { history } = await getStarHistoryResult(owner, repo, info);
  return history;
}

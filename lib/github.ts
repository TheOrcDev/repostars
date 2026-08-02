import { fetchPublicStarHistory } from "@/lib/star-history-providers";

export interface StarDataPoint {
  date: string; // ISO date or timestamp
  stars: number;
}

export type StarHistorySource = "public-snapshots" | "stargazers";

export interface StarHistoryResult {
  currentStars: number;
  estimated: boolean;
  history: StarDataPoint[];
  source: StarHistorySource;
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

let warnedMissingToken = false;
function warnMissingToken() {
  if (warnedMissingToken) {
    return;
  }
  warnedMissingToken = true;
  console.warn(
    "GITHUB_TOKEN is not set. GitHub restricts stargazer history to repository admins and collaborators, so charts fall back to observed public snapshots."
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

interface RestStargazerPage {
  authBlocked: boolean;
  data: StarDataPoint[];
  failed: boolean;
  rateLimited: boolean;
}

async function fetchRestStargazerPage(
  owner: string,
  repo: string,
  page: number
): Promise<RestStargazerPage> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`,
      { headers: headers() }
    );
  } catch {
    return {
      authBlocked: false,
      data: [],
      failed: true,
      rateLimited: false,
    };
  }
  if (!res.ok) {
    const body = await res.text();
    const rateLimited =
      res.status === 429 || body.toLowerCase().includes("rate limit");
    const authBlocked =
      res.status === 401 ||
      res.status === 404 ||
      (res.status === 403 && !rateLimited);
    if (authBlocked && IS_AUTHENTICATED) {
      console.warn(
        `GitHub rejected the stargazers request (HTTP ${res.status}). Stargazer history now requires repository admin or collaborator access; charts fall back to observed public snapshots.`
      );
    }
    return {
      authBlocked,
      data: [],
      failed: !(authBlocked || rateLimited),
      rateLimited,
    };
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    return {
      authBlocked: false,
      data: [],
      failed: true,
      rateLimited: false,
    };
  }
  const parsed = data.flatMap((entry, idx) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("starred_at" in entry) ||
      typeof entry.starred_at !== "string"
    ) {
      return [];
    }
    return [
      {
        date: entry.starred_at,
        stars: (page - 1) * 100 + idx + 1,
      },
    ];
  });
  return {
    authBlocked: false,
    data: parsed,
    failed: parsed.length !== data.length,
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
  if (
    !data ||
    typeof data !== "object" ||
    typeof data.stargazers_count !== "number"
  ) {
    throw new Error(`Invalid GitHub repository response: ${owner}/${repo}`);
  }
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
  let currentStars = totalStars;
  let currentStarsRefreshed = false;
  let completeStargazerList = false;
  let estimated = false;
  let source: StarHistorySource = "stargazers";
  const result = (history: StarDataPoint[]): StarHistoryResult => ({
    currentStars,
    estimated,
    history,
    source,
  });

  if (totalStars === 0) {
    return result([]);
  }

  // GitHub caps stargazer API at 400 pages (40,000 stars)
  const MAX_GITHUB_PAGES = 400;
  const totalPages = Math.ceil(totalStars / 100);
  const fetchablePages = Math.min(totalPages, MAX_GITHUB_PAGES);

  // Keep network work bounded for very large repositories while always
  // retaining the first and final fetchable pages as real history anchors.
  const maxSample = IS_AUTHENTICATED ? 40 : 20;

  let pagesToFetch: number[];

  if (fetchablePages <= maxSample) {
    pagesToFetch = Array.from({ length: fetchablePages }, (_, i) => i + 1);
  } else {
    pagesToFetch = Array.from({ length: maxSample }, (_, index) =>
      Math.round(1 + (index * (fetchablePages - 1)) / (maxSample - 1))
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
    !IS_AUTHENTICATED || probe?.authBlocked || probe?.failed;

  if (accessRestricted) {
    estimated = true;
    source = "public-snapshots";
    const [canonicalOwner = owner, canonicalRepo = repo] =
      resolvedInfo.fullName.split("/");
    results = await fetchPublicStarHistory({
      createdAt: resolvedInfo.createdAt,
      owner: canonicalOwner,
      repoId: resolvedInfo.id,
      repo: canonicalRepo,
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
    const hasMissingProbe = Boolean(
      probe && (probe.authBlocked || probe.failed || probe.rateLimited)
    );
    const hasMissingPages =
      hasMissingProbe ||
      responses.some(
        (response) =>
          response.authBlocked || response.failed || response.rateLimited
      );
    completeStargazerList =
      pagesToFetch.length === totalPages && !hasMissingPages;
    if (!completeStargazerList) {
      estimated = true;
    }

    // Page collection can take long enough for the aggregate count fetched by
    // getRepoData to become stale. Refresh it after the list so we never draw
    // an older metadata total as a newer, fictional decline.
    try {
      currentStars = (await getRepoInfo(owner, repo)).stars;
      currentStarsRefreshed = true;
    } catch {
      currentStars = totalStars;
    }
  }

  if (results.length === 0 && rateLimited) {
    throw new Error(
      "GitHub API rate limit exceeded. Try again later or add a GITHUB_TOKEN."
    );
  }

  // When every requested page succeeded, the list length is a stronger
  // observation than stale metadata if the final metadata refresh failed.
  // Successful empty trailing pages are valid after an unstar crosses a
  // pagination boundary (101 → 100), and page one can validly become empty
  // after the last star is removed (1 → 0).
  if (
    source === "stargazers" &&
    !currentStarsRefreshed &&
    completeStargazerList
  ) {
    if (results.length !== currentStars) {
      estimated = true;
    }
    currentStars = results.length;
  }

  // A successful empty list that still contradicts a refreshed positive
  // aggregate is not usable as history. Fall back to independent public
  // observations instead of claiming the repository has zero stars.
  if (source === "stargazers" && results.length === 0 && currentStars > 0) {
    estimated = true;
    source = "public-snapshots";
    const [canonicalOwner = owner, canonicalRepo = repo] =
      resolvedInfo.fullName.split("/");
    results = await fetchPublicStarHistory({
      createdAt: resolvedInfo.createdAt,
      owner: canonicalOwner,
      repoId: resolvedInfo.id,
      repo: canonicalRepo,
      totalStars: currentStars,
    });
  }

  // Deduplicate observations that share an exact timestamp, then order them by
  // time. Do not force monotonicity: aggregate snapshots can record real
  // unstars, and flattening those declines would manufacture history.
  const byDate = new Map<string, StarDataPoint>();
  for (const point of results) {
    const existing = byDate.get(point.date);
    if (!existing || point.stars >= existing.stars) {
      byDate.set(point.date, point);
    }
  }
  const dedupedAnchors = Array.from(byDate.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (dedupedAnchors.length === 0) {
    return result([]);
  }

  const firstAnchor = dedupedAnchors[0];
  const anchors: StarDataPoint[] =
    firstAnchor.stars === 0
      ? dedupedAnchors
      : [
          {
            date: resolvedInfo.createdAt,
            stars: 0,
          },
          ...dedupedAnchors,
        ];

  const today = new Date().toISOString().slice(0, 10);
  const finalAnchor = anchors.at(-1);
  if (
    source === "stargazers" &&
    !currentStarsRefreshed &&
    finalAnchor &&
    !completeStargazerList &&
    finalAnchor.stars > currentStars
  ) {
    currentStars = finalAnchor.stars;
    estimated = true;
  }
  if (
    source === "stargazers" &&
    finalAnchor &&
    finalAnchor.stars !== currentStars
  ) {
    estimated = estimated || finalAnchor.stars < currentStars;
  }

  // A partial API window cannot establish the missing interval. Keep its real
  // anchors, add only the exact current aggregate, and render it as sparse.
  if (!finalAnchor?.date.startsWith(today)) {
    anchors.push({ date: today, stars: currentStars });
  } else if (finalAnchor.stars !== currentStars) {
    // Preserve the earlier same-day observation and append the exact current
    // aggregate after it. This also captures a real same-day decline.
    anchors.push({ date: new Date().toISOString(), stars: currentStars });
  }

  return result(
    anchors.toSorted(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  );
}

export async function getStarHistory(
  owner: string,
  repo: string,
  info?: RepoInfo
): Promise<StarDataPoint[]> {
  const { history } = await getStarHistoryResult(owner, repo, info);
  return history;
}

import {
  fetchGitHubStarHistory,
  StarHistoryUnavailableError,
} from "@/lib/github-star-history";

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
  return new Date(ms).toISOString().slice(0, 10);
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
 * Last-resort history when GitHub's star history endpoint is unavailable:
 * a straight line from creation to today's exact total. Clients texture it
 * into a plausible curve and label it as estimated.
 */
export function createFallbackEstimate(
  createdAt: string,
  totalStars: number
): StarDataPoint[] {
  const today = toIsoDate(Date.now());
  const createdMs = Date.parse(createdAt);
  const createdDate = Number.isFinite(createdMs) ? toIsoDate(createdMs) : null;

  if (!(createdDate && createdDate < today)) {
    return [{ date: today, stars: totalStars }];
  }

  return [
    { date: createdDate, stars: 0 },
    { date: today, stars: totalStars },
  ];
}

function warnHistoryUnavailable(fullName: string, error: unknown) {
  const reason =
    error instanceof StarHistoryUnavailableError
      ? error.message
      : "Unexpected error while fetching GitHub star history.";
  const hint =
    error instanceof StarHistoryUnavailableError && error.rateLimited
      ? " GitHub rate limit reached; set GITHUB_TOKEN for a higher limit."
      : "";
  console.warn(`${reason} Falling back to an estimate for ${fullName}.${hint}`);
}

/**
 * Exact star history from GitHub's star history endpoint, which returns
 * per-day aggregate counts for every public repository. Falls back to a
 * clearly labelled estimate only when that endpoint fails.
 * Accepts pre-fetched info to avoid a double API call.
 */
export async function getStarHistoryResult(
  owner: string,
  repo: string,
  info?: RepoInfo
): Promise<StarHistoryResult> {
  const resolvedInfo = info ?? (await getRepoInfo(owner, repo));
  const totalStars = resolvedInfo.stars;

  if (totalStars === 0) {
    return { estimated: false, history: [] };
  }

  const [canonicalOwner = owner, canonicalRepo = repo] =
    resolvedInfo.fullName.split("/");

  try {
    const history = await fetchGitHubStarHistory(
      canonicalOwner,
      canonicalRepo,
      { createdAt: resolvedInfo.createdAt, totalStars },
      GITHUB_TOKEN || undefined
    );
    return { estimated: false, history };
  } catch (error) {
    warnHistoryUnavailable(resolvedInfo.fullName, error);
  }

  return {
    estimated: true,
    history: createFallbackEstimate(resolvedInfo.createdAt, totalStars),
  };
}

export async function getStarHistory(
  owner: string,
  repo: string,
  info?: RepoInfo
): Promise<StarDataPoint[]> {
  const { history } = await getStarHistoryResult(owner, repo, info);
  return history;
}

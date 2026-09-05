import type { StarDataPoint } from "@/lib/github";

/**
 * GitHub's privacy-safe star history endpoint returns exact aggregate star
 * counts per day, newest week first, with no stargazer identities and no
 * admin requirement. See
 * https://docs.github.com/rest/activity/starring#get-repository-star-history
 */
const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const WEEKS_PER_PAGE = 30;
const MAX_PAGES = 100;
const PAGE_CONCURRENCY = 6;
const DAYS_PER_WEEK = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = DAYS_PER_WEEK * DAY_MS;
const SECOND_MS = 1000;
// Histories up to about 3.3 years keep one point per day; older repositories
// switch to one exact point per week so charts stay under the pass-through cap.
export const DAILY_HISTORY_MAX_POINTS = 1200;
const LINK_LAST_PAGE_PATTERN = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/;

export interface StarHistoryWeek {
  days: number[];
  total: number;
  week: number;
}

interface FetchStarHistoryOptions {
  createdAt?: string;
  signal?: AbortSignal;
  token?: string;
}

interface ToStarHistoryOptions {
  createdAt: string;
  nowMs: number;
  totalStars: number;
}

export class StarHistoryUnavailableError extends Error {
  readonly rateLimited: boolean;
  readonly status: number | null;

  constructor(message: string, status: number | null, rateLimited = false) {
    super(message);
    this.name = "StarHistoryUnavailableError";
    this.rateLimited = rateLimited;
    this.status = status;
  }
}

function toIsoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isStarHistoryWeek(value: unknown): value is StarHistoryWeek {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { days, total, week } = value as Record<string, unknown>;
  if (
    !(
      Array.isArray(days) &&
      days.length === DAYS_PER_WEEK &&
      days.every(isNonNegativeInteger)
    )
  ) {
    return false;
  }
  if (!(isNonNegativeInteger(total) && isNonNegativeInteger(week))) {
    return false;
  }
  return days.reduce((sum, count) => sum + count, 0) === total;
}

export function parseLinkLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) {
    return null;
  }
  const match = LINK_LAST_PAGE_PATTERN.exec(linkHeader);
  if (!match) {
    return null;
  }
  const page = Number(match[1]);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

function estimatePageCount(createdAt: string | undefined, nowMs: number) {
  if (!createdAt) {
    return 1;
  }
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) {
    return 1;
  }
  const weeks = Math.ceil(Math.max(0, nowMs - createdMs) / WEEK_MS) + 1;
  return Math.max(1, Math.ceil(weeks / WEEKS_PER_PAGE));
}

function historyUrl(owner: string, repo: string, page: number) {
  const url = new URL(
    `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stargazers/history`
  );
  url.searchParams.set("per_page", String(WEEKS_PER_PAGE));
  url.searchParams.set("page", String(page));
  return url;
}

function requestHeaders(token: string | undefined) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RepoStars",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchPage(
  owner: string,
  repo: string,
  page: number,
  options: FetchStarHistoryOptions
): Promise<{ lastPage: number | null; weeks: StarHistoryWeek[] }> {
  const response = await fetch(historyUrl(owner, repo, page), {
    headers: requestHeaders(options.token),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.text();
    const rateLimited =
      response.status === 429 ||
      (response.status === 403 && body.toLowerCase().includes("rate limit"));
    throw new StarHistoryUnavailableError(
      `GitHub star history request failed (HTTP ${response.status}) for ${owner}/${repo} page ${page}.`,
      response.status,
      rateLimited
    );
  }

  const json = (await response.json()) as unknown;
  if (!(Array.isArray(json) && json.every(isStarHistoryWeek))) {
    throw new StarHistoryUnavailableError(
      `GitHub star history returned an unexpected payload for ${owner}/${repo} page ${page}.`,
      response.status
    );
  }

  return {
    lastPage: parseLinkLastPage(response.headers.get("link")),
    weeks: json,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

/**
 * Fetch every page of a repository's star history. The result is newest week
 * first, exactly as GitHub returns it. Any failing page rejects the whole
 * fetch; a partial series would silently drop months of stars.
 */
export async function fetchStarHistoryWeeks(
  owner: string,
  repo: string,
  options: FetchStarHistoryOptions = {}
): Promise<StarHistoryWeek[]> {
  const first = await fetchPage(owner, repo, 1, options);
  const lastPage = Math.min(
    MAX_PAGES,
    first.lastPage ?? estimatePageCount(options.createdAt, Date.now())
  );
  if (lastPage <= 1) {
    return first.weeks;
  }

  const remainingPages = Array.from(
    { length: lastPage - 1 },
    (_, index) => index + 2
  );
  const rest = await mapWithConcurrency(
    remainingPages,
    PAGE_CONCURRENCY,
    (page) => fetchPage(owner, repo, page, options)
  );

  return [...first.weeks, ...rest.flatMap((result) => result.weeks)];
}

function expandDaily(weeks: StarHistoryWeek[], nowMs: number) {
  const points: StarDataPoint[] = [];
  let stars = 0;
  for (const week of weeks) {
    const weekStartMs = week.week * SECOND_MS;
    for (const [dayIndex, count] of week.days.entries()) {
      const dayMs = weekStartMs + dayIndex * DAY_MS;
      if (dayMs > nowMs) {
        break;
      }
      stars += count;
      points.push({ date: toIsoDate(dayMs), stars });
    }
  }
  return points;
}

function expandWeekly(weeks: StarHistoryWeek[], nowMs: number) {
  const points: StarDataPoint[] = [];
  let stars = 0;
  for (const week of weeks) {
    const weekStartMs = week.week * SECOND_MS;
    if (weekStartMs > nowMs) {
      break;
    }
    const weekEndMs = Math.min(
      nowMs,
      weekStartMs + (DAYS_PER_WEEK - 1) * DAY_MS
    );
    stars += week.total;
    points.push({ date: toIsoDate(weekEndMs), stars });
  }
  return points;
}

/**
 * Turn GitHub's weekly buckets into a cumulative, monotone star history.
 * `week` is treated as a calendar date in UTC; GitHub does not guarantee
 * UTC-aligned boundaries, so resolution is at most one day off. The final
 * point is pinned to the repository's exact current total so an in-flight
 * star or stale response never leaves the line short or above the header.
 */
export function toStarHistory(
  weeks: StarHistoryWeek[],
  { createdAt, nowMs, totalStars }: ToStarHistoryOptions
): StarDataPoint[] {
  const ordered = weeks.toSorted((a, b) => a.week - b.week);
  const useDaily = ordered.length * DAYS_PER_WEEK <= DAILY_HISTORY_MAX_POINTS;
  const expanded = useDaily
    ? expandDaily(ordered, nowMs)
    : expandWeekly(ordered, nowMs);

  const createdDate = toIsoDate(Date.parse(createdAt));
  const points = expanded
    .filter((point) => point.date >= createdDate || point.stars > 0)
    .map((point) => ({
      date: point.date,
      stars: Math.min(totalStars, point.stars),
    }));

  const first = points[0];
  if (!first || first.date > createdDate) {
    points.unshift({ date: createdDate, stars: 0 });
  } else if (first.stars > 0) {
    // Stars arrived on the creation day itself; anchor the line at zero the
    // day before so the chart still starts from nothing.
    points.unshift({
      date: toIsoDate(Date.parse(createdAt) - DAY_MS),
      stars: 0,
    });
  }

  const today = toIsoDate(nowMs);
  const last = points.at(-1);
  if (last && last.date === today) {
    last.stars = totalStars;
  } else {
    points.push({ date: today, stars: totalStars });
  }

  return points;
}

export async function fetchGitHubStarHistory(
  owner: string,
  repo: string,
  { createdAt, totalStars }: { createdAt: string; totalStars: number },
  token?: string
): Promise<StarDataPoint[]> {
  const weeks = await fetchStarHistoryWeeks(owner, repo, { createdAt, token });
  return toStarHistory(weeks, { createdAt, nowMs: Date.now(), totalStars });
}

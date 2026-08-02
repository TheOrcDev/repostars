import type { StarDataPoint } from "@/lib/github";

const CLICKHOUSE_API_URL = "https://play.clickhouse.com/";
const CLICKHOUSE_USER = "play";
const CLICKHOUSE_PASSWORD = "clickhouse";
const CLICKHOUSE_TIMEOUT_MS = 3000;
const GITHUB_API_URL = "https://api.github.com";
const WAYBACK_CDX_API_URL = "https://web.archive.org/cdx/search/cdx";
const WAYBACK_CDX_TIMEOUT_MS = 3000;
const WAYBACK_CAPTURE_TIMEOUT_MS = 5000;
const MAX_WAYBACK_CAPTURES = 10;
const MAX_PROVIDER_ROWS = 1200;
const DAY_MS = 24 * 60 * 60 * 1000;
const WAYBACK_MAX_REPO_AGE_MS = 120 * DAY_MS;
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const WAYBACK_TIMESTAMP_PATTERN = /^\d{14}$/;

interface SnapshotHistoryRow {
  date?: unknown;
  stars?: unknown;
}

interface SnapshotHistoryResponse {
  data?: SnapshotHistoryRow[];
}

interface PublicHistoryOptions {
  createdAt: string;
  owner: string;
  repo: string;
  repoId: number;
  totalStars: number;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const date = ISO_DATE_PREFIX.exec(value)?.[0];
  return date && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ? date : null;
}

/**
 * Parse aggregate observations without forcing monotonic growth. A repository
 * can lose stars, and flattening a real decline would manufacture data too.
 */
function parseObservedHistory(rows: SnapshotHistoryRow[] | undefined) {
  const byDate = new Map<string, number>();
  for (const row of (rows ?? []).slice(0, MAX_PROVIDER_ROWS)) {
    const date = parseDate(row.date);
    const stars = Number(row.stars);
    if (!(date && Number.isFinite(stars) && stars >= 0)) {
      continue;
    }
    byDate.set(date, Math.round(stars));
  }

  return Array.from(byDate, ([date, stars]) => ({ date, stars })).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

function addKnownBoundaries(
  history: StarDataPoint[],
  createdAt: string,
  totalStars: number
) {
  const today = todayIsoDate();
  const createdDate = parseDate(createdAt);
  const bounded = history
    .filter((point) => point.date <= today)
    .map((point) => ({ ...point }));
  const firstPoint = bounded[0];

  if (createdDate && (!firstPoint || createdDate < firstPoint.date)) {
    bounded.unshift({ date: createdDate, stars: 0 });
  }

  const lastPoint = bounded.at(-1);
  if (lastPoint?.date === today) {
    if (lastPoint.stars !== totalStars) {
      bounded.push({ date: new Date().toISOString(), stars: totalStars });
    }
  } else {
    bounded.push({ date: today, stars: totalStars });
  }

  return bounded;
}

function isWithinWaybackWindow(createdAt: string) {
  const createdDate = parseDate(createdAt);
  if (!createdDate) {
    return false;
  }
  const ageMs =
    Date.parse(`${todayIsoDate()}T00:00:00Z`) -
    Date.parse(`${createdDate}T00:00:00Z`);
  return ageMs >= 0 && ageMs <= WAYBACK_MAX_REPO_AGE_MS;
}

async function fetchSnapshotHistory(repoId: number) {
  if (!(Number.isSafeInteger(repoId) && repoId > 0)) {
    return [];
  }

  const url = new URL(CLICKHOUSE_API_URL);
  url.searchParams.set("user", CLICKHOUSE_USER);
  url.searchParams.set("password", CLICKHOUSE_PASSWORD);
  const query = `SELECT toDate(time) AS date, argMax(stargazers_count, time) AS stars FROM default.github_repos_history WHERE id = ${repoId} GROUP BY date ORDER BY date LIMIT ${MAX_PROVIDER_ROWS} FORMAT JSON`;
  const response = await fetch(url, {
    body: query,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    method: "POST",
    signal: AbortSignal.timeout(CLICKHOUSE_TIMEOUT_MS),
  });
  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as SnapshotHistoryResponse;
  return parseObservedHistory(json.data);
}

function evenlySample<T>(items: T[], maxItems: number) {
  if (items.length <= maxItems) {
    return items;
  }
  return Array.from({ length: maxItems }, (_, index) => {
    const itemIndex = Math.round((index * (items.length - 1)) / (maxItems - 1));
    return items[itemIndex];
  });
}

/**
 * Archived repository metadata is an exact aggregate observation at capture
 * time. Captures are sparse, so they are returned as anchors without filling
 * or reshaping the intervals between them.
 */
async function fetchWaybackSnapshotHistory(
  owner: string,
  repo: string,
  repoId: number,
  createdAt: string
) {
  const fullName = `${owner}/${repo}`;
  const targetUrl = `${GITHUB_API_URL}/repos/${fullName}`;
  const cdxUrl = new URL(WAYBACK_CDX_API_URL);
  cdxUrl.searchParams.set("url", targetUrl);
  cdxUrl.searchParams.set("matchType", "exact");
  cdxUrl.searchParams.set("output", "json");
  cdxUrl.searchParams.set("filter", "statuscode:200");
  cdxUrl.searchParams.set("fl", "timestamp,original,digest");
  cdxUrl.searchParams.set("collapse", "digest");
  cdxUrl.searchParams.set("limit", "50");

  const cdxResponse = await fetch(cdxUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(WAYBACK_CDX_TIMEOUT_MS),
  });
  if (!cdxResponse.ok) {
    return [];
  }
  const cdxJson = (await cdxResponse.json()) as unknown;
  if (!Array.isArray(cdxJson)) {
    return [];
  }

  const timestamps = cdxJson
    .slice(1)
    .flatMap((row) => {
      if (!Array.isArray(row) || typeof row[0] !== "string") {
        return [];
      }
      return WAYBACK_TIMESTAMP_PATTERN.test(row[0]) ? [row[0]] : [];
    })
    .sort();
  const sampledTimestamps = evenlySample(timestamps, MAX_WAYBACK_CAPTURES);
  const createdDate = parseDate(createdAt);

  const captures = await Promise.all(
    sampledTimestamps.map(async (timestamp) => {
      try {
        const replayUrl = `https://web.archive.org/web/${timestamp}id_/${targetUrl}`;
        const response = await fetch(replayUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(WAYBACK_CAPTURE_TIMEOUT_MS),
        });
        if (!response.ok) {
          return null;
        }
        const json = (await response.json()) as {
          created_at?: unknown;
          full_name?: unknown;
          id?: unknown;
          stargazers_count?: unknown;
        };
        const stars = Number(json.stargazers_count);
        if (
          Number(json.id) !== repoId ||
          typeof json.full_name !== "string" ||
          json.full_name.toLowerCase() !== fullName.toLowerCase() ||
          parseDate(json.created_at) !== createdDate ||
          !Number.isFinite(stars) ||
          stars < 0
        ) {
          return null;
        }
        return {
          date: `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`,
          stars,
        };
      } catch {
        return null;
      }
    })
  );

  return parseObservedHistory(
    captures.flatMap((capture) => (capture ? [capture] : []))
  );
}

function mergeObservedHistories(
  wayback: StarDataPoint[],
  snapshots: StarDataPoint[]
) {
  const byDate = new Map<string, StarDataPoint>();
  for (const point of wayback) {
    byDate.set(point.date, point);
  }
  // Prefer the end-of-day repository snapshot when both sources observed the
  // same date; Wayback captures can occur earlier in that day.
  for (const point of snapshots) {
    byDate.set(point.date, point);
  }
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * Public fallback data is deliberately observation-only. WatchEvent archives
 * are incomplete and have no unstar events, so scaling them to the current
 * total would create a plausible-looking but fictional history.
 */
export async function fetchPublicStarHistory({
  createdAt,
  owner,
  repo,
  repoId,
  totalStars,
}: PublicHistoryOptions): Promise<StarDataPoint[]> {
  const [snapshots, wayback] = await Promise.all([
    fetchSnapshotHistory(repoId).catch(() => [] as StarDataPoint[]),
    isWithinWaybackWindow(createdAt)
      ? fetchWaybackSnapshotHistory(owner, repo, repoId, createdAt).catch(
          () => [] as StarDataPoint[]
        )
      : Promise.resolve([] as StarDataPoint[]),
  ]);

  return addKnownBoundaries(
    mergeObservedHistories(wayback, snapshots),
    createdAt,
    totalStars
  );
}

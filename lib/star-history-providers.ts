import type { StarDataPoint } from "@/lib/github";

const CLICKHOUSE_API_URL = "https://play.clickhouse.com/";
const CLICKHOUSE_USER = "play";
const CLICKHOUSE_PASSWORD = "clickhouse";
const CLICKHOUSE_TIMEOUT_MS = 3000;
const CLICKHOUSE_EVENTS_TIMEOUT_MS = 4000;
const GITHUB_API_URL = "https://api.github.com";
const GITHUB_EVENTS_TIMEOUT_MS = 4000;
const GITHUB_EVENT_PAGES = 3;
const OSS_INSIGHT_API_URL = "https://api.ossinsight.io/v1";
const OSS_INSIGHT_TIMEOUT_MS = 8000;
const WAYBACK_CDX_API_URL = "https://web.archive.org/cdx/search/cdx";
const WAYBACK_CDX_TIMEOUT_MS = 3000;
const WAYBACK_CAPTURE_TIMEOUT_MS = 5000;
const MAX_WAYBACK_CAPTURES = 10;
const MAX_PROVIDER_ROWS = 1200;
const DAY_MS = 24 * 60 * 60 * 1000;
const COMPLETE_ARCHIVE_COVERAGE = 0.9;
const MIN_SHAPE_COVERAGE = 0.25;
const MIN_SHAPE_POINTS = 8;
const MIN_SHAPE_STARS = 25;
const MIN_SHAPE_SPAN_MS = 28 * DAY_MS;
const MIN_SNAPSHOT_POINTS = 3;
const DAILY_EVENT_MAX_AGE_MS = 90 * DAY_MS;
// Keep launch recovery available beyond daily chart bucketing so a repository
// does not lose its curve while the primary snapshot dataset is still catching up.
const LAUNCH_FALLBACK_MAX_AGE_MS = 120 * DAY_MS;
const MIN_RECENT_EVENT_COVERAGE = 0.05;
const MIN_RECENT_EVENT_POINTS = 3;
const MIN_RECENT_EVENT_STARS = 50;
const MIN_RECENT_EVENT_SPAN_MS = 2 * DAY_MS;
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const WAYBACK_TIMESTAMP_PATTERN = /^\d{14}$/;
// GitHub owner/repo names are limited to this charset, which also keeps the
// interpolated ClickHouse query free of quotes and injection vectors.
const GITHUB_FULL_NAME_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

interface ArchiveHistoryRow {
  date?: unknown;
  stargazers?: unknown;
}

interface ArchiveHistoryResponse {
  data?: {
    rows?: ArchiveHistoryRow[];
  };
}

interface SnapshotHistoryRow {
  date?: unknown;
  stars?: unknown;
}

interface SnapshotHistoryResponse {
  data?: SnapshotHistoryRow[];
}

interface EventHistoryRow {
  date?: unknown;
  new_stars?: unknown;
}

interface EventHistoryResponse {
  data?: EventHistoryRow[];
}

interface RecentRepoEvent {
  created_at?: unknown;
  type?: unknown;
}

interface PublicHistoryOptions {
  createdAt: string;
  owner: string;
  repo: string;
  repoId: number;
  requestedName?: string;
  totalStars: number;
}

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const date = ISO_DATE_PREFIX.exec(value)?.[0];
  return date && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ? date : null;
}

function toMonotonicHistory(
  rows: Array<{ date: unknown; stars: unknown }>
): StarDataPoint[] {
  const byDate = new Map<string, number>();
  for (const row of rows.slice(0, MAX_PROVIDER_ROWS)) {
    const date = parseDate(row.date);
    const stars = Number(row.stars);
    if (!(date && Number.isFinite(stars) && stars >= 0)) {
      continue;
    }
    byDate.set(date, Math.max(byDate.get(date) ?? 0, Math.round(stars)));
  }

  let previous = 0;
  return Array.from(byDate, ([date, stars]) => ({ date, stars }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => {
      previous = Math.max(previous, point.stars);
      return { date: point.date, stars: previous };
    });
}

function parseEventHistory(
  rows: EventHistoryRow[] | undefined
): StarDataPoint[] {
  const dailyStars = new Map<string, number>();
  for (const row of (rows ?? []).slice(0, MAX_PROVIDER_ROWS)) {
    const date = parseDate(row.date);
    const count = Number(row.new_stars);
    if (!(date && Number.isFinite(count) && count > 0)) {
      continue;
    }
    dailyStars.set(date, (dailyStars.get(date) ?? 0) + Math.round(count));
  }

  let total = 0;
  return Array.from(dailyStars, ([date, count]) => ({ count, date }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => {
      total += point.count;
      return { date: point.date, stars: total };
    });
}

function parseArchiveHistory(
  rows: ArchiveHistoryRow[] | undefined
): StarDataPoint[] {
  return toMonotonicHistory(
    (rows ?? []).map((row) => ({
      date: row.date,
      stars: row.stargazers,
    }))
  ).filter((point) => point.stars > 0);
}

function parseSnapshotHistory(
  rows: SnapshotHistoryRow[] | undefined
): StarDataPoint[] {
  return toMonotonicHistory(
    (rows ?? []).map((row) => ({ date: row.date, stars: row.stars }))
  ).filter((point) => point.stars > 0);
}

function addKnownBoundaries(
  history: StarDataPoint[],
  createdAt: string,
  totalStars: number
): StarDataPoint[] {
  const today = todayIsoDate();
  const createdDate = parseDate(createdAt);
  const bounded = history.filter((point) => point.date <= today);
  const firstPoint = bounded[0];

  if (createdDate && (!firstPoint || createdDate < firstPoint.date)) {
    bounded.unshift({ date: createdDate, stars: 0 });
  }

  const lastPoint = bounded.at(-1);
  if (lastPoint?.date === today) {
    lastPoint.stars = totalStars;
  } else {
    bounded.push({ date: today, stars: totalStars });
  }

  return bounded;
}

function scaleHistoryToTotal(
  history: StarDataPoint[],
  totalStars: number
): StarDataPoint[] {
  const observedStars = history.at(-1)?.stars ?? 0;
  if (observedStars <= 0) {
    return [];
  }

  let previous = 0;
  const normalized = history.map((point, index) => {
    const isLast = index === history.length - 1;
    const scaled = isLast
      ? totalStars
      : Math.round((point.stars / observedStars) * totalStars);
    const stars = Math.min(totalStars, Math.max(previous, scaled));
    previous = stars;
    return { date: point.date, stars };
  });

  return normalized;
}

function normalizeArchiveShape(
  history: StarDataPoint[],
  createdAt: string,
  totalStars: number
): StarDataPoint[] {
  const normalized = scaleHistoryToTotal(history, totalStars);

  return addKnownBoundaries(normalized, createdAt, totalStars);
}

function historySpanMs(history: StarDataPoint[]) {
  const first = history[0];
  const last = history.at(-1);
  if (!(first && last)) {
    return 0;
  }
  return new Date(last.date).getTime() - new Date(first.date).getTime();
}

/**
 * The snapshot dataset can start late or lag by months. Real star-event
 * counts fill both gaps so the chart keeps the true growth shape instead of
 * long straight segments before the first or after the last snapshot.
 */
function repairHeadWithEvents(
  history: StarDataPoint[],
  events: StarDataPoint[]
): StarDataPoint[] {
  const first = history[0];
  if (!first) {
    return history;
  }
  const head = events.filter((point) => point.date < first.date);
  const boundary = head.at(-1)?.stars ?? 0;
  if (boundary <= 0) {
    return history;
  }

  let previous = 0;
  const scaledHead = head.map((point) => {
    const scaled = Math.round((point.stars / boundary) * first.stars);
    previous = Math.min(first.stars, Math.max(previous, scaled));
    return { date: point.date, stars: previous };
  });

  return [...scaledHead, ...history];
}

function repairTailWithEvents(
  history: StarDataPoint[],
  events: StarDataPoint[],
  totalStars: number
): StarDataPoint[] {
  const last = history.at(-1);
  if (!last || last.stars >= totalStars) {
    return history;
  }
  const tail = events.filter((point) => point.date > last.date);
  if (tail.length === 0) {
    return history;
  }
  const baseline =
    events.findLast((point) => point.date <= last.date)?.stars ?? 0;
  const observedGain = (tail.at(-1)?.stars ?? baseline) - baseline;
  if (observedGain <= 0) {
    return history;
  }

  const starGap = totalStars - last.stars;
  let previous = last.stars;
  const scaledTail = tail.map((point) => {
    const scaled =
      last.stars +
      Math.round(((point.stars - baseline) / observedGain) * starGap);
    previous = Math.min(totalStars, Math.max(previous, scaled));
    return { date: point.date, stars: previous };
  });

  return [...history, ...scaledTail];
}

function hasUsableSnapshotHistory(history: StarDataPoint[]) {
  return (
    history.length >= MIN_SNAPSHOT_POINTS &&
    historySpanMs(history) >= MIN_SHAPE_SPAN_MS
  );
}

function hasUsableArchiveShape(history: StarDataPoint[], totalStars: number) {
  const observedStars = history.at(-1)?.stars ?? 0;
  const coverage = totalStars > 0 ? observedStars / totalStars : 1;
  const nearComplete =
    history.length >= 2 && coverage >= COMPLETE_ARCHIVE_COVERAGE;
  const usefulShapeProxy =
    history.length >= MIN_SHAPE_POINTS &&
    observedStars >= MIN_SHAPE_STARS &&
    coverage >= MIN_SHAPE_COVERAGE &&
    historySpanMs(history) >= MIN_SHAPE_SPAN_MS;

  return nearComplete || usefulShapeProxy;
}

function isWithinRepoAge(createdAt: string, maxAgeMs: number) {
  const createdDate = parseDate(createdAt);
  if (!createdDate) {
    return false;
  }
  const ageMs =
    Date.parse(`${todayIsoDate()}T00:00:00Z`) -
    Date.parse(`${createdDate}T00:00:00Z`);
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

function shouldUseDailyEventBuckets(createdAt: string) {
  return isWithinRepoAge(createdAt, DAILY_EVENT_MAX_AGE_MS);
}

function hasUsableRecentEventTail(
  history: StarDataPoint[],
  totalStars: number
) {
  const observedStars = history.at(-1)?.stars ?? 0;
  const coverage = totalStars > 0 ? observedStars / totalStars : 1;
  return (
    history.length >= MIN_RECENT_EVENT_POINTS &&
    observedStars >= MIN_RECENT_EVENT_STARS &&
    observedStars <= totalStars &&
    coverage >= MIN_RECENT_EVENT_COVERAGE &&
    historySpanMs(history) >= MIN_RECENT_EVENT_SPAN_MS
  );
}

function hasUsableWaybackSnapshots(history: StarDataPoint[]) {
  return history.length >= 2 && historySpanMs(history) >= DAY_MS;
}

function previousIsoDate(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Keep the capped recent event window at its real magnitude. Older sampled
 * events may shape the unknown head, but only up to the inferred baseline
 * (current total minus the visible recent additions).
 */
function createRecentEventEstimate(
  sampledHistory: StarDataPoint[],
  recentHistory: StarDataPoint[],
  createdAt: string,
  totalStars: number
) {
  const firstRecent = recentHistory[0];
  const observedRecentStars = recentHistory.at(-1)?.stars ?? 0;
  if (!(firstRecent && observedRecentStars > 0)) {
    return [];
  }

  const baseline = totalStars - observedRecentStars;
  if (baseline < 0) {
    return [];
  }

  const sampledHead = sampledHistory.filter(
    (point) => point.date < firstRecent.date
  );
  let shapedHead: StarDataPoint[] = [];
  if (baseline > 0) {
    shapedHead =
      sampledHead.length >= 2
        ? scaleHistoryToTotal(sampledHead, baseline)
        : [{ date: previousIsoDate(firstRecent.date), stars: baseline }];
  }
  const anchoredTail = recentHistory.map((point) => ({
    date: point.date,
    stars: baseline + point.stars,
  }));

  return addKnownBoundaries(
    [...shapedHead, ...anchoredTail],
    createdAt,
    totalStars
  );
}

function createSnapshotEstimate(
  createdAt: string,
  totalStars: number
): StarDataPoint[] {
  const today = todayIsoDate();
  const createdDate = parseDate(createdAt);

  if (!(createdDate && createdDate < today)) {
    return [{ date: today, stars: totalStars }];
  }

  return [
    { date: createdDate, stars: 0 },
    { date: today, stars: totalStars },
  ];
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
  return parseSnapshotHistory(json.data);
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
 * Archived GitHub repository metadata contains exact aggregate star counts
 * without exposing stargazer identities. Wayback is a best-effort fallback,
 * so every request is bounded and partial capture failures are tolerated.
 */
async function fetchWaybackSnapshotHistory(
  owner: string,
  repo: string,
  repoId: number,
  createdAt: string,
  totalStars: number
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
          stars < 0 ||
          stars > totalStars
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

  return toMonotonicHistory(
    captures.flatMap((capture) => (capture ? [capture] : []))
  );
}

/**
 * Sampled star (WatchEvent) counts from the GH Archive dataset hosted on
 * ClickHouse Play. Daily buckets preserve launch detail for young repos;
 * weekly buckets keep older histories within the row limit. The archive
 * records events under the repo name at event time, so renamed repos are
 * looked up under every known name.
 */
async function fetchEventHistory(fullNames: string[], daily: boolean) {
  const names = [...new Set(fullNames)].filter((name) =>
    GITHUB_FULL_NAME_PATTERN.test(name)
  );
  if (names.length === 0) {
    return [];
  }

  const url = new URL(CLICKHOUSE_API_URL);
  url.searchParams.set("user", CLICKHOUSE_USER);
  url.searchParams.set("password", CLICKHOUSE_PASSWORD);
  const nameList = names.map((name) => `'${name}'`).join(", ");
  const dateBucket = daily ? "toDate(created_at)" : "toMonday(created_at)";
  const query = `SELECT ${dateBucket} AS date, count() AS new_stars FROM github_events WHERE repo_name IN (${nameList}) AND event_type = 'WatchEvent' GROUP BY date ORDER BY date LIMIT ${MAX_PROVIDER_ROWS} FORMAT JSON`;
  const response = await fetch(url, {
    body: query,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    method: "POST",
    signal: AbortSignal.timeout(CLICKHOUSE_EVENTS_TIMEOUT_MS),
  });
  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as EventHistoryResponse;
  return parseEventHistory(json.data);
}

/**
 * GitHub exposes at most 300 recent repository events. This cannot recover a
 * full history, but for a young repo it supplies a much denser launch sample
 * than GH Archive. The result remains explicitly marked as estimated.
 */
async function fetchRecentEventHistory(owner: string, repo: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RepoStars",
  };
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return [];
  }
  headers.Authorization = `Bearer ${token}`;

  const pageRequests = Array.from(
    { length: GITHUB_EVENT_PAGES },
    async (_, index) => {
      try {
        const url = new URL(
          `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/events`
        );
        url.searchParams.set("per_page", "100");
        url.searchParams.set("page", String(index + 1));
        const response = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(GITHUB_EVENTS_TIMEOUT_MS),
        });
        if (!response.ok) {
          return null;
        }
        const json = (await response.json()) as unknown;
        return Array.isArray(json) ? (json as RecentRepoEvent[]) : null;
      } catch {
        return null;
      }
    }
  );
  const pages = await Promise.all(pageRequests);
  if (pages.some((events) => events === null)) {
    return [];
  }

  return parseEventHistory(
    pages.flatMap((events) =>
      (events ?? []).flatMap((event) =>
        event.type === "WatchEvent"
          ? [{ date: event.created_at, new_stars: 1 }]
          : []
      )
    )
  );
}

async function fetchArchiveHistory(owner: string, repo: string) {
  const url = new URL(
    `${OSS_INSIGHT_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stargazers/history/`
  );
  url.searchParams.set("per", "week");
  url.searchParams.set("from", "2000-01-01");
  url.searchParams.set("to", "2099-01-01");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(OSS_INSIGHT_TIMEOUT_MS),
  });
  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as ArchiveHistoryResponse;
  return parseArchiveHistory(json.data?.rows);
}

export async function fetchPublicStarHistory({
  createdAt,
  owner,
  repo,
  repoId,
  requestedName,
  totalStars,
}: PublicHistoryOptions): Promise<StarDataPoint[]> {
  const eventNames = [`${owner}/${repo}`];
  if (requestedName) {
    eventNames.push(requestedName);
  }
  const dailyEventBuckets = shouldUseDailyEventBuckets(createdAt);
  const useLaunchFallbacks = isWithinRepoAge(
    createdAt,
    LAUNCH_FALLBACK_MAX_AGE_MS
  );

  try {
    const snapshots = await fetchSnapshotHistory(repoId);
    if (hasUsableSnapshotHistory(snapshots)) {
      const events = await fetchEventHistory(
        eventNames,
        dailyEventBuckets
      ).catch(() => [] as StarDataPoint[]);
      const repaired = repairTailWithEvents(
        repairHeadWithEvents(snapshots, events),
        events,
        totalStars
      );
      return addKnownBoundaries(repaired, createdAt, totalStars);
    }
  } catch {
    // Fall through to the public event archive.
  }

  const [sampledEvents, waybackSnapshots] = await Promise.all([
    fetchEventHistory(eventNames, dailyEventBuckets).catch(
      () => [] as StarDataPoint[]
    ),
    useLaunchFallbacks
      ? fetchWaybackSnapshotHistory(
          owner,
          repo,
          repoId,
          createdAt,
          totalStars
        ).catch(() => [] as StarDataPoint[])
      : Promise.resolve([] as StarDataPoint[]),
  ]);

  if (hasUsableWaybackSnapshots(waybackSnapshots)) {
    return addKnownBoundaries(waybackSnapshots, createdAt, totalStars);
  }

  if (hasUsableArchiveShape(sampledEvents, totalStars)) {
    return normalizeArchiveShape(sampledEvents, createdAt, totalStars);
  }

  if (useLaunchFallbacks) {
    try {
      const recentEvents = await fetchRecentEventHistory(owner, repo);
      if (hasUsableRecentEventTail(recentEvents, totalStars)) {
        return createRecentEventEstimate(
          sampledEvents,
          recentEvents,
          createdAt,
          totalStars
        );
      }
    } catch {
      // Fall through to the aggregated archive API.
    }
  }

  try {
    const archive = await fetchArchiveHistory(owner, repo);
    if (hasUsableArchiveShape(archive, totalStars)) {
      return normalizeArchiveShape(archive, createdAt, totalStars);
    }
  } catch {
    // The current aggregate count still supports an honest estimate below.
  }

  return createSnapshotEstimate(createdAt, totalStars);
}

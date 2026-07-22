import type { StarDataPoint } from "@/lib/github";

const OSS_INSIGHT_API_URL = "https://api.ossinsight.io/v1";
const PROVIDER_TIMEOUT_MS = 8000;
const MAX_PROVIDER_ROWS = 1200;
const MIN_ARCHIVE_COVERAGE = 0.9;
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

interface HistoryRow {
  date?: unknown;
  stargazers?: unknown;
}

interface HistoryResponse {
  data?: {
    rows?: HistoryRow[];
  };
}

interface PublicHistoryOptions {
  createdAt: string;
  owner: string;
  repo: string;
  totalStars: number;
}

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseHistoryRows(rows: HistoryRow[] | undefined): StarDataPoint[] {
  return (rows ?? [])
    .slice(0, MAX_PROVIDER_ROWS)
    .flatMap((row) => {
      const date = typeof row.date === "string" ? row.date : "";
      const stars = Number(row.stargazers);

      if (!(date && Number.isFinite(stars) && stars > 0)) {
        return [];
      }

      return [{ date, stars }];
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function normalizeToCurrentCount(
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

  const today = todayIsoDate();
  if (normalized.at(-1)?.date !== today) {
    normalized.push({ date: today, stars: totalStars });
  }
  return normalized;
}

function createSnapshotEstimate(
  createdAt: string,
  totalStars: number
): StarDataPoint[] {
  const today = todayIsoDate();
  const createdDate = ISO_DATE_PREFIX.exec(createdAt)?.[0];

  if (!(createdDate && createdDate < today)) {
    return [{ date: today, stars: totalStars }];
  }

  return [
    { date: createdDate, stars: 0 },
    { date: today, stars: totalStars },
  ];
}

async function fetchOssInsightHistory(
  owner: string,
  repo: string
): Promise<StarDataPoint[]> {
  const url = new URL(
    `${OSS_INSIGHT_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stargazers/history/`
  );
  url.searchParams.set("per", "week");
  url.searchParams.set("from", "2000-01-01");
  url.searchParams.set("to", "2099-01-01");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as HistoryResponse;
  return parseHistoryRows(json.data?.rows);
}

export async function fetchPublicStarHistory({
  createdAt,
  owner,
  repo,
  totalStars,
}: PublicHistoryOptions): Promise<StarDataPoint[]> {
  try {
    const history = await fetchOssInsightHistory(owner, repo);
    const observedStars = history.at(-1)?.stars ?? 0;
    const hasUsableCoverage =
      history.length >= 2 && observedStars >= totalStars * MIN_ARCHIVE_COVERAGE;

    if (hasUsableCoverage) {
      return normalizeToCurrentCount(history, totalStars);
    }
  } catch {
    // The current aggregate count still supports an honest estimate below.
  }

  return createSnapshotEstimate(createdAt, totalStars);
}

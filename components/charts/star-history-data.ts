import type { StarDataPoint } from "@/lib/github";
import type { ChartTheme } from "@/lib/themes";

export interface RepoChartData {
  data: StarDataPoint[];
  estimated: boolean;
  name: string;
  source?: "public-snapshots" | "stargazers";
}

export function isSnapshotHistory(repo: RepoChartData) {
  return (
    repo.source === "public-snapshots" ||
    (repo.source === undefined && repo.estimated)
  );
}

export interface StarHistoryRow extends Record<string, Date | number> {
  date: Date;
}

export interface RepoLegendItem {
  color: string;
  name: string;
  stars: number;
}

export interface RepoGain {
  color: string;
  current: number;
  gain: number;
  name: string;
  previous: number;
}

export interface RangeRepoStat {
  color: string;
  end: number;
  gain: number;
  name: string;
  start: number;
}

export interface RangeStats {
  endDate: Date;
  fastest?: RangeRepoStat;
  repos: RangeRepoStat[];
  startDate: Date;
  totalGain: number;
}

export interface RangeSeries {
  color: string;
  name: string;
}

export interface RingDatum {
  color: string;
  label: string;
  maxValue: number;
  value: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatChartDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function formatFullDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatStars(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
}

export function getRepoSeriesKeys(repos: RepoChartData[]) {
  return repos.map((repo) => repo.name);
}

/**
 * Legend entries for the chart header. The final history point carries the
 * repository's exact current star total, so no extra lookup is needed.
 */
export function getRepoLegendItems(
  repos: RepoChartData[],
  theme: ChartTheme
): RepoLegendItem[] {
  return repos.map((repo, index) => ({
    color: theme.lineColors[index % theme.lineColors.length],
    name: repo.name,
    stars: repo.data.at(-1)?.stars ?? 0,
  }));
}

function getKnownStarsAt(data: StarDataPoint[], dateMs: number): number {
  if (data.length === 0) {
    return 0;
  }

  const firstPoint = data[0];
  const lastPoint = data.at(-1);
  if (!(firstPoint && lastPoint)) {
    return 0;
  }

  const firstMs = new Date(firstPoint.date).getTime();
  const lastMs = new Date(lastPoint.date).getTime();

  if (dateMs <= firstMs) {
    return dateMs === firstMs ? firstPoint.stars : 0;
  }
  if (dateMs >= lastMs) {
    return lastPoint.stars;
  }

  let low = 0;
  let high = data.length - 1;
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (new Date(data[mid].date).getTime() <= dateMs) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return data[low].stars;
}

function mergeObservedHistories(repos: RepoChartData[]) {
  const rowsByTime = new Map<number, StarHistoryRow>();
  for (const repo of repos) {
    for (const point of repo.data) {
      const pointMs = new Date(point.date).getTime();
      if (!Number.isFinite(pointMs)) {
        continue;
      }
      const row = rowsByTime.get(pointMs) ?? { date: new Date(pointMs) };
      row[repo.name] = point.stars;
      rowsByTime.set(pointMs, row);
    }
  }

  const rows = Array.from(rowsByTime.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const exactRepos = repos.flatMap((repo) => {
    const first = repo.data[0];
    const last = repo.data.at(-1);
    if (repo.estimated || !(first && last)) {
      return [];
    }
    return [
      {
        firstMs: new Date(first.date).getTime(),
        lastMs: new Date(last.date).getTime(),
        repo,
      },
    ];
  });
  for (const row of rows) {
    const rowMs = row.date.getTime();
    for (const { firstMs, lastMs, repo } of exactRepos) {
      if (
        typeof row[repo.name] !== "number" &&
        rowMs >= firstMs &&
        rowMs <= lastMs
      ) {
        row[repo.name] = getKnownStarsAt(repo.data, rowMs);
      }
    }
  }
  return rows;
}

export function mergeStarHistories(
  repos: RepoChartData[],
  _options: { pointCount?: number; step?: boolean } = {}
): StarHistoryRow[] {
  const populatedRepos = repos.filter((repo) => repo.data.length > 0);
  if (populatedRepos.length === 0) {
    return [];
  }

  if (populatedRepos.length > 1) {
    return mergeObservedHistories(populatedRepos);
  }

  const [repo] = populatedRepos;
  return repo.data.map((point) => ({
    date: new Date(point.date),
    [repo.name]: point.stars,
  }));
}

export function getGrowthStats(
  repos: RepoChartData[],
  theme: ChartTheme,
  days: number
): RepoGain[] {
  return repos.flatMap((repo, index) => {
    if (repo.estimated) {
      return [];
    }
    const latest = repo.data.at(-1);
    if (!latest) {
      return [];
    }

    const latestMs = new Date(latest.date).getTime();
    const previous = getKnownStarsAt(repo.data, latestMs - days * DAY_MS);
    return [
      {
        color: theme.lineColors[index % theme.lineColors.length],
        current: latest.stars,
        gain: Math.max(0, latest.stars - previous),
        name: repo.name,
        previous,
      },
    ];
  });
}

export function getStarShareData(
  repos: RepoChartData[],
  theme: ChartTheme
): RingDatum[] {
  const values = repos.map((repo) => repo.data.at(-1)?.stars ?? 0);
  const maxValue = Math.max(1, ...values);

  return repos.map((repo, index) => ({
    color: theme.lineColors[index % theme.lineColors.length],
    label: repo.name,
    maxValue,
    value: values[index] ?? 0,
  }));
}

export function getRangeStats(
  rows: StarHistoryRow[],
  series: RangeSeries[],
  startIndex: number,
  endIndex: number
): RangeStats | null {
  const normalizedStart = Math.max(0, Math.min(startIndex, endIndex));
  const normalizedEnd = Math.min(
    rows.length - 1,
    Math.max(startIndex, endIndex)
  );
  const startRow = rows[normalizedStart];
  const endRow = rows[normalizedEnd];
  if (!(startRow && endRow)) {
    return null;
  }

  const repoStats = series.map(({ color, name }) => {
    const start = Number(startRow[name] ?? 0);
    const end = Number(endRow[name] ?? 0);
    return {
      color,
      end,
      gain: end - start,
      name,
      start,
    };
  });
  const fastest = repoStats.toSorted((a, b) => b.gain - a.gain)[0];

  return {
    endDate: endRow.date,
    fastest,
    repos: repoStats,
    startDate: startRow.date,
    totalGain: repoStats.reduce((total, repo) => total + repo.gain, 0),
  };
}

export function getChartThemeVars(theme: ChartTheme) {
  const colors = theme.lineColors;
  return {
    "--chart-1": colors[0],
    "--chart-2": colors[1] ?? colors[0],
    "--chart-3": colors[2] ?? colors[0],
    "--chart-4": colors[3] ?? colors[0],
    "--chart-5": colors[4] ?? colors[0],
    "--chart-background": theme.background,
    "--chart-brush-border": theme.gridColor,
    "--chart-crosshair": colors[0],
    "--chart-foreground": theme.textColor,
    "--chart-foreground-muted": theme.textColor,
    "--chart-grid": theme.gridColor,
    "--chart-label": theme.textColor,
    "--chart-line-primary": colors[0],
    "--chart-line-secondary": colors[1] ?? colors[0],
    "--chart-marker-background": theme.background,
    "--chart-marker-border": theme.gridColor,
    "--chart-marker-foreground": theme.textColor,
    "--chart-ring-background": `${theme.gridColor}66`,
    "--chart-segment-background": `${theme.textColor}14`,
    "--chart-segment-line": `${theme.textColor}55`,
    "--chart-tooltip-background": theme.tooltipBg,
    "--chart-tooltip-foreground": theme.tooltipText,
    "--chart-tooltip-muted": theme.textColor,
  } as Record<string, string>;
}

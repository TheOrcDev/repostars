import type { StarDataPoint } from "@/lib/github";
import type { ChartTheme } from "@/lib/themes";

export interface RepoChartData {
  data: StarDataPoint[];
  name: string;
}

export interface StarHistoryRow extends Record<string, Date | number> {
  date: Date;
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

export interface RingDatum {
  color: string;
  label: string;
  maxValue: number;
  value: number;
}

const TIMELINE_POINT_COUNT = 200;
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

export function interpolateStarsAt(
  data: StarDataPoint[],
  dateMs: number,
  options: { step?: boolean } = {}
): number {
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

  if (options.step) {
    return data[low].stars;
  }

  const lowMs = new Date(data[low].date).getTime();
  const highMs = new Date(data[high].date).getTime();
  if (highMs === lowMs) {
    return data[low].stars;
  }

  const progress = (dateMs - lowMs) / (highMs - lowMs);
  return Math.round(
    data[low].stars + progress * (data[high].stars - data[low].stars)
  );
}

export function mergeStarHistories(
  repos: RepoChartData[],
  options: { pointCount?: number; step?: boolean } = {}
): StarHistoryRow[] {
  const populatedRepos = repos.filter((repo) => repo.data.length > 0);
  if (populatedRepos.length === 0) {
    return [];
  }

  if (populatedRepos.length === 1 && options.pointCount == null) {
    const [repo] = populatedRepos;
    return repo.data.map((point) => ({
      date: new Date(point.date),
      [repo.name]: point.stars,
    }));
  }

  let globalMin = Number.POSITIVE_INFINITY;
  let globalMax = Number.NEGATIVE_INFINITY;
  for (const repo of populatedRepos) {
    for (const point of repo.data) {
      const pointMs = new Date(point.date).getTime();
      globalMin = Math.min(globalMin, pointMs);
      globalMax = Math.max(globalMax, pointMs);
    }
  }

  if (!(Number.isFinite(globalMin) && Number.isFinite(globalMax))) {
    return [];
  }

  const pointCount = options.pointCount ?? TIMELINE_POINT_COUNT;
  const step = pointCount > 1 ? (globalMax - globalMin) / (pointCount - 1) : 0;

  return Array.from({ length: pointCount }, (_, index) => {
    const dateMs = globalMin + step * index;
    const row: StarHistoryRow = { date: new Date(dateMs) };
    for (const repo of populatedRepos) {
      row[repo.name] = interpolateStarsAt(repo.data, dateMs, {
        step: options.step,
      });
    }
    return row;
  });
}

export function getGrowthStats(
  repos: RepoChartData[],
  theme: ChartTheme,
  days: number
): RepoGain[] {
  return repos.map((repo, index) => {
    const latest = repo.data.at(-1);
    if (!latest) {
      return {
        color: theme.lineColors[index % theme.lineColors.length],
        current: 0,
        gain: 0,
        name: repo.name,
        previous: 0,
      };
    }

    const latestMs = new Date(latest.date).getTime();
    const previous = interpolateStarsAt(repo.data, latestMs - days * DAY_MS);
    return {
      color: theme.lineColors[index % theme.lineColors.length],
      current: latest.stars,
      gain: Math.max(0, latest.stars - previous),
      name: repo.name,
      previous,
    };
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
  repoNames: string[],
  theme: ChartTheme,
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

  const repoStats = repoNames.map((name, index) => {
    const start = Number(startRow[name] ?? 0);
    const end = Number(endRow[name] ?? 0);
    return {
      color: theme.lineColors[index % theme.lineColors.length],
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

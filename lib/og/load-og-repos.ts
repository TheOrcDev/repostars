import {
  getGrowthStats,
  mergeStarHistories,
  type RepoChartData,
} from "@/components/charts/star-history-data";
import type { StarDataPoint } from "@/lib/github";
import { getRepoData, type RepoData } from "@/lib/repo-cache";
import type { ChartTheme } from "@/lib/themes";

export const OG_MAX_REPOS = 5;
export const OG_REPO_TIMEOUT_MS = 2500;
export const OG_SERIES_POINTS = 160;
export const OG_GROWTH_WINDOW_DAYS = 90;
const GITHUB_FULL_NAME_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export interface OgLoadedRepo {
  createdAt: string;
  description: string;
  estimated: boolean;
  fullName: string;
  history: StarDataPoint[];
  language: string | null;
  requestedName: string;
  stars: number;
  status: "ok";
}

export interface OgUnavailableRepo {
  requestedName: string;
  status: "unavailable";
}

export type OgRepo = OgLoadedRepo | OgUnavailableRepo;

export interface OgSeries {
  color: string;
  estimated: boolean;
  gain: number;
  name: string;
  stars: number;
  values: number[];
}

export interface OgChart {
  dates: Date[];
  maxValue: number;
  series: OgSeries[];
}

type RepoLoader = (owner: string, repo: string) => Promise<RepoData>;

interface LoadOgReposOptions {
  load?: RepoLoader;
  timeoutMs?: number;
}

/**
 * `repos` query param → up to five unique, well-formed owner/repo names.
 */
export function parseOgRepoNames(param: string | null | undefined): string[] {
  if (!param) {
    return [];
  }
  const names: string[] = [];
  const seen = new Set<string>();
  for (const raw of param.split(",")) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!GITHUB_FULL_NAME_PATTERN.test(name) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(name);
    if (names.length === OG_MAX_REPOS) {
      break;
    }
  }
  return names;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Load every requested repository in parallel. A repository that fails or
 * exceeds the timeout is reported as unavailable rather than replaced, so a
 * share link never shows someone else's data.
 */
export async function loadOgRepos(
  names: string[],
  {
    load = getRepoData,
    timeoutMs = OG_REPO_TIMEOUT_MS,
  }: LoadOgReposOptions = {}
): Promise<OgRepo[]> {
  const settled = await Promise.allSettled(
    names.map((name) => {
      const [owner, repo] = name.split("/");
      return withTimeout(load(owner, repo), timeoutMs);
    })
  );

  return settled.map((result, index) => {
    const requestedName = names[index];
    if (result.status === "rejected") {
      return { requestedName, status: "unavailable" };
    }
    const { estimated, history, info } = result.value;
    return {
      createdAt: info.createdAt,
      description: info.description,
      estimated,
      fullName: info.fullName,
      history,
      language: info.language,
      requestedName,
      stars: info.stars,
      status: "ok",
    };
  });
}

export function isLoadedRepo(repo: OgRepo): repo is OgLoadedRepo {
  return repo.status === "ok";
}

/**
 * Resample every loaded history onto one shared time grid, exactly as the
 * in-app chart does, so the preview and the page agree on shape.
 */
export function buildOgChart(
  repos: OgLoadedRepo[],
  theme: ChartTheme
): OgChart | null {
  const chartRepos: RepoChartData[] = repos.map((repo) => ({
    data: repo.history,
    estimated: repo.estimated,
    name: repo.fullName,
  }));
  const rows = mergeStarHistories(chartRepos, {
    pointCount: OG_SERIES_POINTS,
    step: true,
  });
  if (rows.length === 0) {
    return null;
  }

  const growth = getGrowthStats(chartRepos, theme, OG_GROWTH_WINDOW_DAYS);
  let maxValue = 1;
  const series: OgSeries[] = repos.map((repo, index) => {
    const values = rows.map((row) => Number(row[repo.fullName] ?? 0));
    for (const value of values) {
      maxValue = Math.max(maxValue, value);
    }
    return {
      color: theme.lineColors[index % theme.lineColors.length],
      estimated: repo.estimated,
      gain: growth[index]?.gain ?? 0,
      name: repo.fullName,
      stars: repo.stars,
      values,
    };
  });

  return { dates: rows.map((row) => row.date), maxValue, series };
}

/**
 * Vertical positions for end-of-line value labels. Labels are placed top to
 * bottom; any label closer than `minGap` to the previous kept label is
 * dropped (null) instead of overlapping it.
 */
export function placeEndLabels(
  ys: number[],
  minGap: number
): Array<number | null> {
  const order = ys.map((y, index) => ({ index, y })).sort((a, b) => a.y - b.y);
  const placed: Array<number | null> = ys.map(() => null);
  let previous = Number.NEGATIVE_INFINITY;
  for (const { index, y } of order) {
    if (y - previous >= minGap) {
      placed[index] = y;
      previous = y;
    }
  }
  return placed;
}

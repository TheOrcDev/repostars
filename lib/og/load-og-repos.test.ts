import { describe, expect, it, vi } from "vitest";
import {
  buildOgChart,
  loadOgRepos,
  OG_SERIES_POINTS,
  type OgLoadedRepo,
  parseOgRepoNames,
  placeEndLabels,
} from "@/lib/og/load-og-repos";
import type { RepoData } from "@/lib/repo-cache";
import { themes } from "@/lib/themes";

function repoData(fullName: string, stars: number): RepoData {
  const [owner, repo] = fullName.split("/");
  return {
    estimated: false,
    history: [
      { date: "2024-01-01", stars: 0 },
      { date: "2024-06-01", stars: Math.round(stars / 2) },
      { date: "2024-12-01", stars },
    ],
    info: {
      createdAt: "2024-01-01T00:00:00Z",
      description: `${repo} description`,
      fullName,
      id: 1,
      language: "TypeScript",
      owner,
      repo,
      stars,
    },
  };
}

describe("parseOgRepoNames", () => {
  it("keeps up to five unique well-formed names", () => {
    expect(
      parseOgRepoNames(
        "a/one, b/two,a/ONE,not-a-repo,c/three,d/four,e/five,f/six"
      )
    ).toEqual(["a/one", "b/two", "c/three", "d/four", "e/five"]);
  });

  it("returns nothing for an empty param", () => {
    expect(parseOgRepoNames(null)).toEqual([]);
    expect(parseOgRepoNames("")).toEqual([]);
  });
});

describe("loadOgRepos", () => {
  it("marks failed and slow repositories unavailable instead of replacing them", async () => {
    vi.useFakeTimers();
    const load = vi.fn((owner: string, repo: string) => {
      if (repo === "slow") {
        return new Promise<RepoData>(() => undefined);
      }
      if (repo === "missing") {
        return Promise.reject(new Error("Repo not found: acme/missing"));
      }
      return Promise.resolve(repoData(`${owner}/${repo}`, 10));
    });

    const pending = loadOgRepos(["acme/ok", "acme/slow", "acme/missing"], {
      load,
      timeoutMs: 100,
    });
    await vi.advanceTimersByTimeAsync(150);
    const repos = await pending;
    vi.useRealTimers();

    expect(repos.map((repo) => repo.status)).toEqual([
      "ok",
      "unavailable",
      "unavailable",
    ]);
    expect(repos[0]).toMatchObject({
      fullName: "acme/ok",
      requestedName: "acme/ok",
      stars: 10,
    });
    expect(repos[1]).toEqual({
      requestedName: "acme/slow",
      status: "unavailable",
    });
  });
});

describe("buildOgChart", () => {
  it("resamples every repository onto one shared grid", () => {
    const repos: OgLoadedRepo[] = [
      toLoaded("acme/big", 1000),
      toLoaded("acme/small", 10),
    ];

    const chart = buildOgChart(repos, themes.dark);

    expect(chart).not.toBeNull();
    expect(chart?.dates).toHaveLength(OG_SERIES_POINTS);
    expect(chart?.series.map((series) => series.values.length)).toEqual([
      OG_SERIES_POINTS,
      OG_SERIES_POINTS,
    ]);
    expect(chart?.maxValue).toBe(1000);
    expect(chart?.series[0].values.at(-1)).toBe(1000);
    expect(chart?.series[1].values.at(-1)).toBe(10);
    expect(chart?.series[0].color).toBe(themes.dark.lineColors[0]);
    expect(chart?.series[1].color).toBe(themes.dark.lineColors[1]);
  });

  it("returns null without any history", () => {
    expect(
      buildOgChart([{ ...toLoaded("acme/empty", 0), history: [] }], themes.dark)
    ).toBeNull();
  });
});

describe("placeEndLabels", () => {
  it("drops labels that would overlap the previous kept label", () => {
    expect(placeEndLabels([100, 110, 200, 215, 260], 28)).toEqual([
      100,
      null,
      200,
      null,
      260,
    ]);
  });
});

function toLoaded(fullName: string, stars: number): OgLoadedRepo {
  const data = repoData(fullName, stars);
  return {
    createdAt: data.info.createdAt,
    description: data.info.description,
    estimated: data.estimated,
    fullName,
    history: data.history,
    language: data.info.language,
    requestedName: fullName,
    stars,
    status: "ok",
  };
}

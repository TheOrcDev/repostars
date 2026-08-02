import { describe, expect, it } from "vitest";
import {
  getGrowthStats,
  getRangeStats,
  getRepoLegendItems,
  mergeStarHistories,
  type RepoChartData,
} from "@/components/charts/star-history-data";
import { themes } from "@/lib/themes";

const theme = themes.dark;

function repo(name: string, stars: number[]): RepoChartData {
  return {
    data: stars.map((count, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      stars: count,
    })),
    estimated: false,
    name,
  };
}

describe("getRepoLegendItems", () => {
  it("uses the latest history point as the repository's star total", () => {
    const items = getRepoLegendItems(
      [repo("acme/widget", [1, 40, 396])],
      theme
    );

    expect(items).toEqual([
      { color: theme.lineColors[0], name: "acme/widget", stars: 396 },
    ]);
  });

  it("assigns each repository its series color, cycling past the palette", () => {
    const repos = Array.from({ length: theme.lineColors.length + 1 }, (_, i) =>
      repo(`acme/repo-${i}`, [i])
    );

    const colors = getRepoLegendItems(repos, theme).map((item) => item.color);

    expect(colors.at(-1)).toBe(theme.lineColors[0]);
    expect(colors.slice(0, theme.lineColors.length)).toEqual(theme.lineColors);
  });

  it("falls back to zero stars for a repository without history", () => {
    const items = getRepoLegendItems([repo("acme/empty", [])], theme);

    expect(items[0].stars).toBe(0);
  });
});

describe("mergeStarHistories", () => {
  it("renders an estimated single-repository history from observed anchors only", () => {
    const name = "DavidHDev/canvas-ui";
    const anchors = [
      { date: "2026-07-16", stars: 0 },
      { date: "2026-07-23", stars: 265 },
      { date: "2026-07-24", stars: 1573 },
      { date: "2026-07-31", stars: 2803 },
      { date: "2026-08-02", stars: 3086 },
    ];

    const rows = mergeStarHistories([{ data: anchors, estimated: true, name }]);

    expect(rows).toEqual(
      anchors.map((anchor) => ({
        date: new Date(anchor.date),
        [name]: anchor.stars,
      }))
    );
  });

  it("keeps exact single-repository histories on their source points", () => {
    const exactRepo = repo("acme/exact", [0, 100, 240]);

    expect(mergeStarHistories([exactRepo])).toEqual([
      { date: new Date("2026-01-01"), "acme/exact": 0 },
      { date: new Date("2026-01-02"), "acme/exact": 100 },
      { date: new Date("2026-01-03"), "acme/exact": 240 },
    ]);
  });

  it("does not manufacture intermediate counts across a large estimated gap", () => {
    const name = "acme/viral";
    const rows = mergeStarHistories([
      {
        data: [
          { date: "2026-01-01", stars: 0 },
          { date: "2026-01-02", stars: 1_000_000 },
        ],
        estimated: true,
        name,
      },
    ]);

    expect(rows).toEqual([
      { date: new Date("2026-01-01"), [name]: 0 },
      { date: new Date("2026-01-02"), [name]: 1_000_000 },
    ]);
  });

  it("does not resample estimated anchors for stepped presentation", () => {
    const name = "DavidHDev/canvas-ui";
    const anchors = [
      { date: "2026-07-16", stars: 0 },
      { date: "2026-07-23", stars: 265 },
      { date: "2026-07-24", stars: 1573 },
      { date: "2026-07-31", stars: 2803 },
      { date: "2026-08-02", stars: 3086 },
    ];

    const rows = mergeStarHistories(
      [{ data: anchors, estimated: true, name }],
      { pointCount: 72, step: true }
    );

    expect(rows).toEqual(
      anchors.map((anchor) => ({
        date: new Date(anchor.date),
        [name]: anchor.stars,
      }))
    );
  });

  it("keeps mixed sparse histories inside each repository's observed bounds", () => {
    const rows = mergeStarHistories([
      {
        data: [
          { date: "2026-01-01", stars: 0 },
          { date: "2026-01-03", stars: 30 },
        ],
        estimated: true,
        name: "acme/observed",
      },
      {
        data: [
          { date: "2026-01-02", stars: 10 },
          { date: "2026-01-04", stars: 20 },
        ],
        estimated: false,
        name: "acme/exact",
      },
    ]);

    expect(rows).toEqual([
      { date: new Date("2026-01-01"), "acme/observed": 0 },
      { date: new Date("2026-01-02"), "acme/exact": 10 },
      {
        date: new Date("2026-01-03"),
        "acme/exact": 10,
        "acme/observed": 30,
      },
      { date: new Date("2026-01-04"), "acme/exact": 20 },
    ]);
  });

  it("uses only source timestamps for multi-repository presentation sampling", () => {
    const rows = mergeStarHistories(
      [
        {
          data: [
            { date: "2026-01-01", stars: 0 },
            { date: "2026-01-04", stars: 40 },
          ],
          estimated: false,
          name: "acme/early",
        },
        {
          data: [
            { date: "2026-01-02", stars: 10 },
            { date: "2026-01-03", stars: 15 },
          ],
          estimated: false,
          name: "acme/late",
        },
      ],
      { pointCount: 72, step: true }
    );

    expect(rows.map((row) => row.date)).toEqual([
      new Date("2026-01-01"),
      new Date("2026-01-02"),
      new Date("2026-01-03"),
      new Date("2026-01-04"),
    ]);
  });

  it("retains every sparse estimated anchor without filling unknown dates", () => {
    const rows = mergeStarHistories([
      {
        data: [
          { date: "2026-01-01", stars: 0 },
          { date: "2026-01-04", stars: 400 },
        ],
        estimated: true,
        name: "acme/alpha",
      },
      {
        data: [
          { date: "2026-01-02", stars: 20 },
          { date: "2026-01-03", stars: 75 },
        ],
        estimated: true,
        name: "acme/beta",
      },
    ]);

    expect(rows).toEqual([
      { date: new Date("2026-01-01"), "acme/alpha": 0 },
      { date: new Date("2026-01-02"), "acme/beta": 20 },
      { date: new Date("2026-01-03"), "acme/beta": 75 },
      { date: new Date("2026-01-04"), "acme/alpha": 400 },
    ]);
  });

  it("does not extend a later repository back before its first observation", () => {
    const rows = mergeStarHistories([
      {
        data: [
          { date: "2026-01-01", stars: 5 },
          { date: "2026-01-04", stars: 20 },
        ],
        estimated: false,
        name: "acme/early",
      },
      {
        data: [
          { date: "2026-01-03", stars: 1 },
          { date: "2026-01-04", stars: 2 },
        ],
        estimated: false,
        name: "acme/late",
      },
    ]);

    expect(rows[0]).not.toHaveProperty("acme/late");
    expect(rows[1]).toMatchObject({
      date: new Date("2026-01-03"),
      "acme/early": 5,
      "acme/late": 1,
    });
  });
});

describe("getGrowthStats", () => {
  it("uses the last exact star event at the window boundary", () => {
    const exactRepo: RepoChartData = {
      data: [
        { date: "2026-01-01", stars: 10 },
        { date: "2026-04-01", stars: 100 },
        { date: "2026-04-11", stars: 120 },
      ],
      estimated: false,
      name: "acme/exact",
    };

    expect(getGrowthStats([exactRepo], theme, 90)).toEqual([
      {
        color: theme.lineColors[0],
        current: 120,
        gain: 110,
        name: "acme/exact",
        previous: 10,
      },
    ]);
  });

  it("omits estimated histories whose window delta is unknowable", () => {
    const estimatedRepo: RepoChartData = {
      data: [
        { date: "2026-01-01", stars: 10 },
        { date: "2026-04-11", stars: 120 },
      ],
      estimated: true,
      name: "acme/estimated",
    };

    expect(getGrowthStats([estimatedRepo], theme, 90)).toEqual([]);
  });

  it("preserves chart color indexes when estimated histories are omitted", () => {
    const estimatedRepo: RepoChartData = {
      data: [{ date: "2026-04-11", stars: 120 }],
      estimated: true,
      name: "acme/estimated",
    };
    const exactRepo: RepoChartData = {
      data: [
        { date: "2026-01-01", stars: 10 },
        { date: "2026-04-11", stars: 120 },
      ],
      estimated: false,
      name: "acme/exact",
    };

    expect(
      getGrowthStats([estimatedRepo, exactRepo], theme, 90)[0]?.color
    ).toBe(theme.lineColors[1]);
  });
});

describe("getRangeStats", () => {
  it("uses the series' original chart color", () => {
    const rows = [
      { date: new Date("2026-01-01"), "acme/exact": 10 },
      { date: new Date("2026-01-02"), "acme/exact": 15 },
    ];

    const stats = getRangeStats(
      rows,
      [{ color: theme.lineColors[1], name: "acme/exact" }],
      0,
      1
    );

    expect(stats?.repos[0]?.color).toBe(theme.lineColors[1]);
  });
});

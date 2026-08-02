import { describe, expect, it } from "vitest";
import {
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
  it("expands sparse estimated anchors into a bursty, anchor-exact series", () => {
    const name = "DavidHDev/canvas-ui";
    const anchors = [
      { date: "2026-07-16", stars: 0 },
      { date: "2026-07-23", stars: 265 },
      { date: "2026-07-24", stars: 1573 },
      { date: "2026-07-31", stars: 2803 },
      { date: "2026-08-02", stars: 3086 },
    ];

    const rows = mergeStarHistories([{ data: anchors, estimated: true, name }]);

    expect(rows.length).toBeGreaterThan(anchors.length);
    expect(rows.length).toBeLessThanOrEqual(640);
    for (const anchor of anchors) {
      expect(rows).toContainEqual({
        date: new Date(anchor.date),
        [name]: anchor.stars,
      });
    }

    const deltas: number[] = [];
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const row = rows[index];
      expect(row.date.getTime()).toBeGreaterThan(previous.date.getTime());
      expect(Number(row[name])).toBeGreaterThanOrEqual(Number(previous[name]));
      expect(Number.isInteger(Number(row[name]))).toBe(true);
      expect(Number(row[name])).toBeLessThanOrEqual(3086);
      const delta = Number(row[name]) - Number(previous[name]);
      if (delta > 0) {
        deltas.push(delta);
      }
    }

    // Texture, not a straight line: gains vary instead of marching evenly.
    const mean = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    expect(new Set(deltas).size).toBeGreaterThan(5);
    expect(Math.max(...deltas)).toBeGreaterThan(mean * 1.5);

    // Deterministic: re-rendering the same data yields the same curve.
    expect(
      mergeStarHistories([{ data: anchors, estimated: true, name }])
    ).toEqual(rows);
  });

  it("keeps exact single-repository histories on their source points", () => {
    const exactRepo = repo("acme/exact", [0, 100, 240]);

    expect(mergeStarHistories([exactRepo])).toEqual([
      { date: new Date("2026-01-01"), "acme/exact": 0 },
      { date: new Date("2026-01-02"), "acme/exact": 100 },
      { date: new Date("2026-01-03"), "acme/exact": 240 },
    ]);
  });

  it("keeps estimated timeline expansion within its point budget", () => {
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

    expect(rows.length).toBeLessThanOrEqual(640);
    expect(rows[0]).toEqual({ date: new Date("2026-01-01"), [name]: 0 });
    expect(rows.at(-1)).toEqual({
      date: new Date("2026-01-02"),
      [name]: 1_000_000,
    });
  });

  it("keeps explicit stepped timelines discrete for the 8-bit chart", () => {
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

    expect(rows).toHaveLength(72);
    let previous = 0;
    for (const row of rows) {
      const value = Number(row[name]);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(3086);
      previous = value;
    }
    // Steps sample the textured series, so they land on more levels than the
    // five raw anchors while staying discrete.
    const distinctLevels = new Set(rows.map((row) => Number(row[name])));
    expect(distinctLevels.size).toBeGreaterThan(anchors.length);
    expect(rows.at(-1)).toEqual({
      date: new Date("2026-08-02"),
      [name]: 3086,
    });
  });
});

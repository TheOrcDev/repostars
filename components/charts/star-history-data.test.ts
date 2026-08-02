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
  it("densifies sparse single-repository anchors for smooth hover values", () => {
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

    const largestJump = rows.slice(1).reduce((maxJump, row, index) => {
      const previous = rows[index];
      expect(row.date.getTime()).toBeGreaterThan(
        previous?.date.getTime() ?? Number.NEGATIVE_INFINITY
      );
      expect(Number(row[name])).toBeGreaterThanOrEqual(
        Number(previous?.[name] ?? 0)
      );
      expect(Number.isInteger(Number(row[name]))).toBe(true);
      expect(Number(row[name])).toBeLessThanOrEqual(3086);
      return Math.max(
        maxJump,
        Number(row[name]) - Number(previous?.[name] ?? 0)
      );
    }, 0);

    expect(largestJump).toBeLessThanOrEqual(50);
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
    const anchorValues = new Set(anchors.map((anchor) => anchor.stars));

    expect(rows).toHaveLength(72);
    expect(rows.every((row) => anchorValues.has(Number(row[name])))).toBe(true);
    expect(rows.at(-1)).toEqual({
      date: new Date("2026-08-02"),
      [name]: 3086,
    });
  });
});

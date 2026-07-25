import { describe, expect, it } from "vitest";
import {
  getRepoLegendItems,
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

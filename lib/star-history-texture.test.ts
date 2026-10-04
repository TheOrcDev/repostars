import { describe, expect, it } from "vitest";
import {
  expandYoungRepoHourly,
  texturizeEstimatedHistory,
  YOUNG_REPO_HOURLY_MAX_AGE_MS,
} from "@/lib/star-history-texture";

const REPO = "DavidHDev/canvas-ui";
const ANCHORS = [
  { date: "2026-07-16", stars: 0 },
  { date: "2026-07-23", stars: 265 },
  { date: "2026-07-24", stars: 1573 },
  { date: "2026-07-31", stars: 2803 },
  { date: "2026-08-02", stars: 3086 },
];

describe("texturizeEstimatedHistory", () => {
  it("reproduces every anchor exactly", () => {
    const points = texturizeEstimatedHistory(REPO, ANCHORS);

    for (const anchor of ANCHORS) {
      const match = points.find(
        (point) =>
          new Date(point.date).getTime() === new Date(anchor.date).getTime()
      );
      expect(match?.stars).toBe(anchor.stars);
    }
  });

  it("stays monotone with integer stars and ascending dates", () => {
    const points = texturizeEstimatedHistory(REPO, ANCHORS);

    expect(points.length).toBeGreaterThan(ANCHORS.length);
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      expect(new Date(current.date).getTime()).toBeGreaterThan(
        new Date(previous.date).getTime()
      );
      expect(current.stars).toBeGreaterThanOrEqual(previous.stars);
      expect(Number.isInteger(current.stars)).toBe(true);
    }
    expect(points.at(-1)?.stars).toBe(3086);
  });

  it("is deterministic across invocations", () => {
    expect(texturizeEstimatedHistory(REPO, ANCHORS)).toEqual(
      texturizeEstimatedHistory(REPO, ANCHORS)
    );
  });

  it("keeps historical segments stable when new anchors append", () => {
    const before = texturizeEstimatedHistory(REPO, ANCHORS);
    const after = texturizeEstimatedHistory(REPO, [
      ...ANCHORS,
      { date: "2026-08-09", stars: 3400 },
    ]);

    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("distributes gain unevenly instead of a straight line", () => {
    const points = texturizeEstimatedHistory(REPO, ANCHORS);
    const deltas = points
      .slice(1)
      .map((point, index) => point.stars - points[index].stars)
      .filter((delta) => delta > 0);

    const mean =
      deltas.reduce((sum, delta) => sum + delta, 0) /
      Math.max(1, deltas.length);
    expect(new Set(deltas).size).toBeGreaterThan(5);
    expect(Math.max(...deltas)).toBeGreaterThan(mean * 1.5);
  });

  it("uses sub-day buckets for short segments", () => {
    const points = texturizeEstimatedHistory(REPO, [
      { date: "2026-07-23", stars: 265 },
      { date: "2026-07-24", stars: 1573 },
    ]);

    expect(points.length).toBeGreaterThanOrEqual(20);
    expect(points.at(-1)).toEqual({ date: "2026-07-24", stars: 1573 });
  });

  it("keeps plateaus flat rather than inventing motion", () => {
    const points = texturizeEstimatedHistory(REPO, [
      { date: "2026-06-01", stars: 100 },
      { date: "2026-06-20", stars: 100 },
    ]);

    expect(points.every((point) => point.stars === 100)).toBe(true);
  });

  it("respects the point budget", () => {
    const yearsApart = [
      { date: "2020-01-01", stars: 0 },
      { date: "2023-01-01", stars: 40_000 },
      { date: "2026-01-01", stars: 90_000 },
    ];

    expect(
      texturizeEstimatedHistory(REPO, yearsApart).length
    ).toBeLessThanOrEqual(640);
    expect(
      texturizeEstimatedHistory(REPO, yearsApart, 120).length
    ).toBeLessThanOrEqual(120);
  });

  it("passes dense or degenerate inputs through untouched", () => {
    const single = [{ date: "2026-07-16", stars: 10 }];
    expect(texturizeEstimatedHistory(REPO, single)).toEqual(single);

    const dense = Array.from({ length: 400 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
      stars: index,
    }));
    expect(texturizeEstimatedHistory(REPO, dense)).toEqual(dense);
  });
});

const YOUNG_DAILY = [
  { date: "2026-09-30", stars: 0 },
  { date: "2026-10-01", stars: 1 },
  { date: "2026-10-02", stars: 111 },
  { date: "2026-10-03", stars: 149 },
  { date: "2026-10-04", stars: 151 },
];

describe("expandYoungRepoHourly", () => {
  const createdAt = "2026-09-30T14:04:23Z";
  const nowMs = Date.parse("2026-10-04T12:00:00Z");

  it("spreads a first-week history across hours without moving daily totals", () => {
    const points = expandYoungRepoHourly(REPO, createdAt, YOUNG_DAILY, nowMs);

    expect(points.length).toBeGreaterThan(YOUNG_DAILY.length * 10);
    expect(points.some((point) => point.date.includes("T"))).toBe(true);
    for (const anchor of YOUNG_DAILY) {
      expect(points.find((point) => point.date === anchor.date)?.stars).toBe(
        anchor.stars
      );
    }

    const spikeStart = points.findIndex((point) => point.date === "2026-10-01");
    const spikeEnd = points.findIndex((point) => point.date === "2026-10-02");
    const spike = points.slice(spikeStart, spikeEnd + 1);
    const deltas = spike
      .slice(1)
      .map((point, index) => point.stars - spike[index].stars);
    expect(Math.max(...deltas) - Math.min(...deltas)).toBeGreaterThan(0);
    expect(spike.at(-1)?.stars).toBe(111);
    expect(spike[0]?.stars).toBe(1);
  });

  it("leaves older repositories on their daily totals", () => {
    const afterTheFirstWeek =
      Date.parse(createdAt) + YOUNG_REPO_HOURLY_MAX_AGE_MS + 60_000;
    expect(
      expandYoungRepoHourly(REPO, createdAt, YOUNG_DAILY, afterTheFirstWeek)
    ).toEqual(YOUNG_DAILY);
  });

  it("leaves an already hourly series untouched", () => {
    const hourly = [
      { date: "2026-10-04T00:00:00.000Z", stars: 0 },
      { date: "2026-10-04T01:00:00.000Z", stars: 4 },
    ];
    expect(
      expandYoungRepoHourly(REPO, "2026-10-04T00:00:00Z", hourly, nowMs)
    ).toEqual(hourly);
  });
});

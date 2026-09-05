import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_HISTORY_MAX_POINTS,
  fetchStarHistoryWeeks,
  parseLinkLastPage,
  StarHistoryUnavailableError,
  type StarHistoryWeek,
  toStarHistory,
} from "@/lib/github-star-history";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_SECONDS = 7 * 24 * 60 * 60;
// Sunday 2026-08-30 00:00 UTC, the newest week GitHub returned in probes.
const NEWEST_WEEK = 1_788_048_000;
const NOW_MS = Date.UTC(2026, 8, 5, 12); // Saturday 2026-09-05

function week(
  weekSeconds: number,
  days: number[],
  total = days.reduce((sum, count) => sum + count, 0)
): StarHistoryWeek {
  return { days, total, week: weekSeconds };
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parseLinkLastPage", () => {
  it("reads the last page from GitHub's Link header", () => {
    expect(
      parseLinkLastPage(
        '<https://api.github.com/repositories/1/stargazers/history?per_page=30&page=2>; rel="next", <https://api.github.com/repositories/1/stargazers/history?per_page=30&page=18>; rel="last"'
      )
    ).toBe(18);
  });

  it("returns null without a last relation", () => {
    expect(parseLinkLastPage(null)).toBeNull();
    expect(
      parseLinkLastPage(
        '<https://api.github.com/repositories/1/stargazers/history?page=1>; rel="prev"'
      )
    ).toBeNull();
  });
});

describe("toStarHistory", () => {
  it("expands newest-first weeks into cumulative daily points", () => {
    const history = toStarHistory(
      [
        week(NEWEST_WEEK, [1, 0, 2, 0, 0, 0, 0]),
        week(NEWEST_WEEK - WEEK_SECONDS, [0, 3, 0, 0, 0, 0, 4]),
      ],
      { createdAt: "2026-08-23T09:00:00Z", nowMs: NOW_MS, totalStars: 10 }
    );

    expect(history).toEqual([
      { date: "2026-08-23", stars: 0 },
      { date: "2026-08-24", stars: 3 },
      { date: "2026-08-25", stars: 3 },
      { date: "2026-08-26", stars: 3 },
      { date: "2026-08-27", stars: 3 },
      { date: "2026-08-28", stars: 3 },
      { date: "2026-08-29", stars: 7 },
      { date: "2026-08-30", stars: 8 },
      { date: "2026-08-31", stars: 8 },
      { date: "2026-09-01", stars: 10 },
      { date: "2026-09-02", stars: 10 },
      { date: "2026-09-03", stars: 10 },
      { date: "2026-09-04", stars: 10 },
      { date: "2026-09-05", stars: 10 },
    ]);
  });

  it("drops days after today and pins today's point to the exact total", () => {
    const history = toStarHistory([week(NEWEST_WEEK, [1, 1, 1, 1, 1, 1, 1])], {
      createdAt: "2026-08-30T00:00:00Z",
      nowMs: NOW_MS,
      totalStars: 6,
    });

    expect(history.at(-1)).toEqual({ date: "2026-09-05", stars: 6 });
    expect(history.some((point) => point.date > "2026-09-05")).toBe(false);
  });

  it("appends today when the newest week ended before today", () => {
    const history = toStarHistory(
      [week(NEWEST_WEEK - 2 * WEEK_SECONDS, [0, 0, 0, 5, 0, 0, 0])],
      { createdAt: "2026-08-16T00:00:00Z", nowMs: NOW_MS, totalStars: 5 }
    );

    expect(history.at(-1)).toEqual({ date: "2026-09-05", stars: 5 });
    expect(history.at(-2)).toEqual({ date: "2026-08-22", stars: 5 });
  });

  it("drops empty days before creation and anchors at zero", () => {
    const history = toStarHistory([week(NEWEST_WEEK, [0, 0, 0, 0, 2, 0, 0])], {
      createdAt: "2026-09-02T18:00:00Z",
      nowMs: NOW_MS,
      totalStars: 2,
    });

    expect(history[0]).toEqual({ date: "2026-09-02", stars: 0 });
    expect(history[1]).toEqual({ date: "2026-09-03", stars: 2 });
    expect(history.some((point) => point.date < "2026-09-02")).toBe(false);
  });

  it("anchors at zero the day before when stars arrive on creation day", () => {
    const history = toStarHistory([week(NEWEST_WEEK, [0, 0, 0, 2, 0, 0, 0])], {
      createdAt: "2026-09-02T18:00:00Z",
      nowMs: NOW_MS,
      totalStars: 2,
    });

    expect(history.slice(0, 2)).toEqual([
      { date: "2026-09-01", stars: 0 },
      { date: "2026-09-02", stars: 2 },
    ]);
  });

  it("switches to weekly resolution for long histories", () => {
    const weekCount = Math.floor(DAILY_HISTORY_MAX_POINTS / 7) + 1;
    const weeks = Array.from({ length: weekCount }, (_, index) =>
      week(NEWEST_WEEK - index * WEEK_SECONDS, [1, 1, 1, 1, 1, 1, 1])
    );
    const createdAt = new Date(
      (NEWEST_WEEK - (weekCount - 1) * WEEK_SECONDS) * 1000
    ).toISOString();

    const history = toStarHistory(weeks, {
      createdAt,
      nowMs: NOW_MS,
      totalStars: weekCount * 7,
    });

    // One point per week plus the creation anchor; today's Saturday closes the
    // newest week so no extra point is appended.
    expect(history).toHaveLength(weekCount + 1);
    expect(history[1]).toEqual({
      date: new Date(
        (NEWEST_WEEK - (weekCount - 1) * WEEK_SECONDS) * 1000 + 6 * DAY_MS
      )
        .toISOString()
        .slice(0, 10),
      stars: 7,
    });
    expect(history.at(-1)).toEqual({
      date: "2026-09-05",
      stars: weekCount * 7,
    });
  });

  it("never exceeds the repository's current total", () => {
    const history = toStarHistory([week(NEWEST_WEEK, [4, 4, 4, 0, 0, 0, 0])], {
      createdAt: "2026-08-30T00:00:00Z",
      nowMs: NOW_MS,
      totalStars: 10,
    });

    expect(Math.max(...history.map((point) => point.stars))).toBe(10);
    expect(history.at(-1)).toEqual({ date: "2026-09-05", stars: 10 });
  });
});

describe("fetchStarHistoryWeeks", () => {
  it("follows the Link header and concatenates pages newest first", async () => {
    const pages: Record<string, StarHistoryWeek[]> = {
      "1": [week(NEWEST_WEEK, [1, 0, 0, 0, 0, 0, 0])],
      "2": [week(NEWEST_WEEK - WEEK_SECONDS, [0, 2, 0, 0, 0, 0, 0])],
      "3": [week(NEWEST_WEEK - 2 * WEEK_SECONDS, [0, 0, 3, 0, 0, 0, 0])],
    };
    const fetchMock = vi.fn(
      (input: string | URL | Request, _init?: RequestInit) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString()
        );
        expect(url.pathname).toBe("/repos/acme/widget/stargazers/history");
        expect(url.searchParams.get("per_page")).toBe("30");
        const page = url.searchParams.get("page") ?? "1";
        return jsonResponse(pages[page], {
          headers:
            page === "1"
              ? {
                  Link: '<https://api.github.com/repositories/1/stargazers/history?per_page=30&page=2>; rel="next", <https://api.github.com/repositories/1/stargazers/history?per_page=30&page=3>; rel="last"',
                }
              : {},
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const weeks = await fetchStarHistoryWeeks("acme", "widget", {
      token: "test-token",
    });

    expect(weeks.map((entry) => entry.week)).toEqual([
      NEWEST_WEEK,
      NEWEST_WEEK - WEEK_SECONDS,
      NEWEST_WEEK - 2 * WEEK_SECONDS,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "X-GitHub-Api-Version": "2026-03-10",
    });
  });

  it("rejects the whole fetch when any page fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString()
        );
        if (url.searchParams.get("page") === "2") {
          return jsonResponse(
            { message: "API rate limit exceeded" },
            { status: 403 }
          );
        }
        return jsonResponse([week(NEWEST_WEEK, [1, 0, 0, 0, 0, 0, 0])], {
          headers: {
            Link: '<https://api.github.com/repositories/1/stargazers/history?per_page=30&page=2>; rel="last"',
          },
        });
      })
    );

    const attempt = fetchStarHistoryWeeks("acme", "widget");
    await expect(attempt).rejects.toBeInstanceOf(StarHistoryUnavailableError);
    await expect(attempt).rejects.toMatchObject({
      rateLimited: true,
      status: 403,
    });
  });

  it("rejects malformed payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse([{ days: [1, 2], total: 3, week: NEWEST_WEEK }]))
    );

    await expect(
      fetchStarHistoryWeeks("acme", "widget")
    ).rejects.toBeInstanceOf(StarHistoryUnavailableError);
  });

  it("estimates the page count from the creation date without a Link header", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_MS));
    const fetchMock = vi.fn(() => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchStarHistoryWeeks("acme", "widget", {
      // 45 weeks old: two pages of 30.
      createdAt: new Date(NOW_MS - 45 * 7 * DAY_MS).toISOString(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACCESS_DENIED = "Resource not accessible by personal access token";
const TODAY = "2026-07-22";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
});

afterEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

describe("getStarHistory", () => {
  it("keeps authorized stargazer timestamps as exact source anchors", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse([
            { starred_at: "2026-01-02T10:00:00Z" },
            { starred_at: "2026-01-03T10:00:00Z" },
            { starred_at: "2026-01-04T10:00:00Z" },
          ]);
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-01-01T08:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 100,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 3,
    });

    expect(result).toEqual({
      currentStars: 3,
      estimated: false,
      history: [
        { date: "2026-01-01T08:00:00Z", stars: 0 },
        { date: "2026-01-02T10:00:00Z", stars: 1 },
        { date: "2026-01-03T10:00:00Z", stars: 2 },
        { date: "2026-01-04T10:00:00Z", stars: 3 },
        { date: TODAY, stars: 3 },
      ],
      source: "stargazers",
    });
  });

  it("marks an authorized history sparse when an intermediate page fails", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString()
        );
        const page = Number(url.searchParams.get("page"));
        if (page === 2) {
          return jsonResponse(
            { message: "API rate limit exceeded" },
            { status: 429 }
          );
        }
        const pageStart = (page - 1) * 100;
        return jsonResponse(
          Array.from({ length: 100 }, (_, index) => ({
            starred_at: new Date(
              Date.UTC(2026, 0, 2, 0, pageStart + index)
            ).toISOString(),
          }))
        );
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-01-01T08:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 101,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 300,
    });

    expect(result.estimated).toBe(true);
    expect(result.history).toHaveLength(202);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 300 });
    expect(result.history.some((point) => point.stars === 200)).toBe(false);
  });

  it("marks an authorized history sparse when the probe page is rate limited", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString()
        );
        const page = Number(url.searchParams.get("page"));
        if (page === 1) {
          return jsonResponse(
            { message: "API rate limit exceeded" },
            { status: 429 }
          );
        }
        const pageStart = (page - 1) * 100;
        return jsonResponse(
          Array.from({ length: 100 }, (_, index) => ({
            starred_at: new Date(
              Date.UTC(2026, 0, 2, 0, pageStart + index)
            ).toISOString(),
          }))
        );
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-01-01T08:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 102,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 300,
    });

    expect(result.estimated).toBe(true);
    expect(result.history.some((point) => point.stars === 1)).toBe(false);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 300 });
  });

  it("refreshes the current total after page collection without inventing a decline", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url === "https://api.github.com/repos/acme/widget") {
          return jsonResponse({
            created_at: "2026-01-01T08:00:00Z",
            description: "",
            full_name: "acme/widget",
            id: 103,
            language: null,
            stargazers_count: 100,
          });
        }
        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse(
            Array.from({ length: 100 }, (_, index) => ({
              starred_at: new Date(
                Date.UTC(2026, 0, 2, 0, index)
              ).toISOString(),
            }))
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-01-01T08:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 103,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 99,
    });

    expect(result.currentStars).toBe(100);
    expect(result.estimated).toBe(false);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 100 });
  });

  it("uses a complete stargazer list when the aggregate refresh fails", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url === "https://api.github.com/repos/acme/widget") {
          return jsonResponse({ message: "Unavailable" }, { status: 503 });
        }
        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse([
            { starred_at: "2026-01-02T08:00:00Z" },
            { starred_at: "2026-01-03T08:00:00Z" },
          ]);
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-01-01T08:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 104,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 3,
    });

    expect(result.currentStars).toBe(2);
    expect(result.estimated).toBe(true);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 2 });
  });

  it("accepts an empty trailing page after a 101 to 100 star decline", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString()
        );
        if (url.pathname === "/repos/acme/widget") {
          return jsonResponse({ message: "Unavailable" }, { status: 503 });
        }
        if (url.pathname.endsWith("/stargazers")) {
          const page = Number(url.searchParams.get("page"));
          if (page === 2) {
            return jsonResponse([]);
          }
          return jsonResponse(
            Array.from({ length: 100 }, (_, index) => ({
              starred_at: new Date(
                Date.UTC(2026, 0, 2, 0, index)
              ).toISOString(),
            }))
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-01-01T08:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 105,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 101,
    });

    expect(result.currentStars).toBe(100);
    expect(result.estimated).toBe(true);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 100 });
    expect(result.history.some((point) => point.stars === 101)).toBe(false);
  });

  it("accepts an empty first page after the final star is removed", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString()
        );
        if (url.pathname === "/repos/acme/widget") {
          return jsonResponse({ message: "Unavailable" }, { status: 503 });
        }
        if (url.pathname.endsWith("/stargazers")) {
          return jsonResponse([]);
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-01-01T08:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 106,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 1,
    });

    expect(result.currentStars).toBe(0);
    expect(result.estimated).toBe(true);
    expect(result.history).toEqual([]);
    expect(result.source).toBe("stargazers");
  });

  it("does not treat a complete-looking event archive as aggregate history", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
        return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
      }

      if (url.includes("api.ossinsight.io")) {
        expect(new URL(url).searchParams.get("per")).toBe("week");
        return jsonResponse({
          data: {
            rows: [
              { date: "2024-01-01", stargazers: "1" },
              { date: "2024-02-01", stargazers: "2" },
            ],
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistory } = await import("@/lib/github");
    const history = await getStarHistory("acme", "widget", {
      createdAt: "2023-12-15T00:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 1,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 2,
    });

    expect(history).toEqual([
      { date: "2023-12-15", stars: 0 },
      { date: TODAY, stars: 2 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().includes("api.github.com/graphql")
      )
    ).toBe(false);
  });

  it("uses a creation-to-current estimate when archive coverage is sparse", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
        return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
      }

      if (url.includes("api.ossinsight.io")) {
        return jsonResponse({
          data: {
            rows: [
              { date: "2026-02-25", stargazers: "1" },
              { date: "2026-05-03", stargazers: "2" },
              { date: "2026-07-05", stargazers: "3" },
            ],
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistory } = await import("@/lib/github");
    const history = await getStarHistory("acme", "widget", {
      createdAt: "2026-02-23T10:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 2,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 40,
    });

    expect(history).toEqual([
      { date: "2026-02-23", stars: 0 },
      { date: TODAY, stars: 40 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves every aggregate snapshot without adding inferred points", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
        return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
      }

      if (url.includes("play.clickhouse.com")) {
        return jsonResponse({
          data: [
            { date: "2025-04-23", stars: 237 },
            { date: "2025-05-07", stars: 331 },
            { date: "2025-06-06", stars: 496 },
            { date: "2025-07-18", stars: 647 },
            { date: "2025-09-11", stars: 914 },
            { date: "2025-12-31", stars: 1389 },
            { date: "2026-01-15", stars: 1482 },
            { date: "2026-02-06", stars: 1554 },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2025-03-27T16:11:51Z",
      description: "",
      fullName: "acme/widget",
      id: 956_053_274,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 1952,
    });

    expect(result.estimated).toBe(true);
    expect(result.history).toEqual([
      { date: "2025-03-27", stars: 0 },
      { date: "2025-04-23", stars: 237 },
      { date: "2025-05-07", stars: 331 },
      { date: "2025-06-06", stars: 496 },
      { date: "2025-07-18", stars: 647 },
      { date: "2025-09-11", stars: 914 },
      { date: "2025-12-31", stars: 1389 },
      { date: "2026-01-15", stars: 1482 },
      { date: "2026-02-06", stars: 1554 },
      { date: TODAY, stars: 1952 },
    ]);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().includes("api.ossinsight.io")
      )
    ).toBe(false);
  });

  it("preserves a real decline between aggregate snapshots", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }

        if (url.includes("play.clickhouse.com")) {
          const body = String(init?.body ?? "");
          return jsonResponse({
            data: body.includes("github_repos_history")
              ? [
                  { date: "2026-01-01", stars: 100 },
                  { date: "2026-02-01", stars: 94 },
                  { date: "2026-03-01", stars: 115 },
                ]
              : [],
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2025-12-15T00:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 956_053_274,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 120,
    });

    expect(result.history).toEqual([
      { date: "2025-12-15", stars: 0 },
      { date: "2026-01-01", stars: 100 },
      { date: "2026-02-01", stars: 94 },
      { date: "2026-03-01", stars: 115 },
      { date: TODAY, stars: 120 },
    ]);
  });

  it("does not scale an incomplete event archive into synthetic star totals", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }

        if (url.includes("play.clickhouse.com")) {
          return jsonResponse({ data: [] });
        }

        if (url.includes("api.ossinsight.io")) {
          return jsonResponse({
            data: {
              rows: [
                { date: "2025-03-31", stargazers: "3" },
                { date: "2025-04-07", stargazers: "203" },
                { date: "2025-04-14", stargazers: "247" },
                { date: "2025-05-19", stargazers: "400" },
                { date: "2025-08-25", stargazers: "651" },
                { date: "2026-01-05", stargazers: "903" },
                { date: "2026-04-13", stargazers: "1000" },
                { date: "2026-06-29", stargazers: "1007" },
              ],
            },
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2025-03-27T16:11:51Z",
      description: "",
      fullName: "acme/widget",
      id: 956_053_274,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 1952,
    });

    expect(result.history).toEqual([
      { date: "2025-03-27", stars: 0 },
      { date: TODAY, stars: 1952 },
    ]);
  });

  it("still returns an estimate when the public provider is unavailable", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }

        return jsonResponse({ message: "Unavailable" }, { status: 503 });
      })
    );

    const { getStarHistory } = await import("@/lib/github");
    const history = await getStarHistory("acme", "widget", {
      createdAt: "2024-01-15T10:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 3,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 2,
    });

    expect(history.at(-1)).toEqual({ date: TODAY, stars: 2 });
  });

  it("uses public observations when an empty list contradicts refreshed metadata", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse([]);
        }

        if (url === "https://api.github.com/repos/acme/widget") {
          return jsonResponse({
            created_at: "2023-12-15T00:00:00Z",
            description: "",
            full_name: "acme/widget",
            id: 4,
            language: null,
            stargazers_count: 2,
          });
        }

        if (url.includes("play.clickhouse.com")) {
          return jsonResponse({
            data: [{ date: "2024-01-01", stars: 1 }],
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2023-12-15T00:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 4,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 2,
    });

    expect(result.estimated).toBe(true);
    expect(result.source).toBe("public-snapshots");
    expect(result.history).toContainEqual({ date: "2024-01-01", stars: 1 });
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 2 });
  });

  it("does not scale sampled public events when no token is configured", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("play.clickhouse.com")) {
          const body = String(init?.body ?? "");
          if (body.includes("github_repos_history")) {
            return jsonResponse({ data: [] });
          }
          if (body.includes("github_events")) {
            return jsonResponse({
              data: [
                { date: "2026-07-06", new_stars: "200" },
                { date: "2026-07-10", new_stars: "160" },
              ],
            });
          }
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-05-30T09:47:59Z",
      description: "",
      fullName: "acme/widget",
      id: 5,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 396,
    });

    expect(result.estimated).toBe(true);
    expect(result.history).toEqual([
      { date: "2026-05-30", stars: 0 },
      { date: TODAY, stars: 396 },
    ]);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().startsWith("https://api.github.com")
      )
    ).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("falls back to estimation when GitHub rejects the token with a 401", async () => {
    vi.stubEnv("GITHUB_TOKEN", "expired-token");
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse(
            { message: "Requires authentication" },
            { status: 401 }
          );
        }

        if (url.includes("play.clickhouse.com")) {
          const body = String(init?.body ?? "");
          if (body.includes("github_repos_history")) {
            return jsonResponse({ data: [] });
          }
          if (body.includes("github_events")) {
            return jsonResponse({
              data: [
                { date: "2026-06-01", new_stars: 10 },
                { date: "2026-06-15", new_stars: 10 },
              ],
            });
          }
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-05-01T00:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 6,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 21,
    });

    expect(result.estimated).toBe(true);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 21 });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it.each([
    {
      name: "for young repositories",
      now: "2026-08-02T21:00:00Z",
      today: "2026-08-02",
    },
    {
      name: "after daily event bucketing expires",
      now: "2026-10-16T21:00:00Z",
      today: "2026-10-16",
    },
  ])("uses archived aggregate snapshots $name", async ({ now, today }) => {
    vi.setSystemTime(new Date(now));
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    const recentEvents = (date: string, count: number) =>
      Array.from({ length: count }, () => ({
        created_at: `${date}T12:00:00Z`,
        type: "WatchEvent",
      }));

    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (
          url.includes("api.github.com/repos/DavidHDev/canvas-ui/stargazers")
        ) {
          return jsonResponse({ message: "Not Found" }, { status: 404 });
        }

        if (url.includes("play.clickhouse.com")) {
          const body = String(init?.body ?? "");
          if (body.includes("github_repos_history")) {
            return jsonResponse({ data: [] });
          }
          if (body.includes("github_events")) {
            return jsonResponse({
              data: [
                { date: "2026-07-24", new_stars: 2 },
                { date: "2026-07-25", new_stars: 1 },
                { date: "2026-07-29", new_stars: 2 },
                { date: "2026-07-30", new_stars: 2 },
                { date: "2026-08-02", new_stars: 2 },
              ],
            });
          }
        }

        if (url.includes("web.archive.org/cdx/search/cdx")) {
          return jsonResponse([
            ["timestamp", "original", "digest"],
            [
              "20260723133535",
              "https://api.github.com/repos/DavidHDev/canvas-ui",
              "capture-one",
            ],
            [
              "20260724192403",
              "https://api.github.com/repos/DavidHDev/canvas-ui",
              "capture-two",
            ],
            [
              "20260731171457",
              "https://api.github.com/repos/DavidHDev/canvas-ui",
              "capture-three",
            ],
          ]);
        }

        if (url.includes("web.archive.org/web/20260723133535id_")) {
          return jsonResponse({
            created_at: "2026-07-16T13:38:20Z",
            full_name: "DavidHDev/canvas-ui",
            id: 1_302_826_522,
            stargazers_count: 265,
          });
        }
        if (url.includes("web.archive.org/web/20260724192403id_")) {
          return jsonResponse({
            created_at: "2026-07-16T13:38:20Z",
            full_name: "DavidHDev/canvas-ui",
            id: 1_302_826_522,
            stargazers_count: 1573,
          });
        }
        if (url.includes("web.archive.org/web/20260731171457id_")) {
          return jsonResponse({
            created_at: "2026-07-16T13:38:20Z",
            full_name: "DavidHDev/canvas-ui",
            id: 1_302_826_522,
            stargazers_count: 2803,
          });
        }

        if (url.includes("api.github.com/repos/DavidHDev/canvas-ui/events")) {
          const page = Number(new URL(url).searchParams.get("page"));
          if (page === 1) {
            return jsonResponse(recentEvents("2026-08-02", 90));
          }
          if (page === 2) {
            return jsonResponse(recentEvents("2026-08-01", 70));
          }
          return jsonResponse(recentEvents("2026-07-31", 50));
        }

        if (url.includes("api.ossinsight.io")) {
          return jsonResponse({ data: { rows: [] } });
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("DavidHDev", "canvas-ui", {
      createdAt: "2026-07-16T13:38:20Z",
      description: "Canvas UI",
      fullName: "DavidHDev/canvas-ui",
      id: 1_302_826_522,
      language: "TypeScript",
      owner: "DavidHDev",
      repo: "canvas-ui",
      stars: 3082,
    });

    expect(result.estimated).toBe(true);
    expect(result.history).toEqual([
      { date: "2026-07-16", stars: 0 },
      { date: "2026-07-23", stars: 265 },
      { date: "2026-07-24", stars: 1573 },
      { date: "2026-07-31", stars: 2803 },
      { date: today, stars: 3082 },
    ]);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input
          .toString()
          .includes("api.github.com/repos/DavidHDev/canvas-ui/events")
      )
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([, init]) =>
        String(init?.body ?? "").includes("github_events")
      )
    ).toBe(false);
  });

  it("keeps an archived count above today's total after real unstars", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("api.github.com/repos/acme/decline/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }
        if (url.includes("play.clickhouse.com")) {
          expect(String(init?.body ?? "")).toContain("github_repos_history");
          return jsonResponse({ data: [] });
        }
        if (url.includes("web.archive.org/cdx/search/cdx")) {
          return jsonResponse([
            ["timestamp", "original", "digest"],
            [
              "20260710120000",
              "https://api.github.com/repos/acme/decline",
              "capture-one",
            ],
          ]);
        }
        if (url.includes("web.archive.org/web/20260710120000id_")) {
          return jsonResponse({
            created_at: "2026-06-01T00:00:00Z",
            full_name: "acme/decline",
            id: 102,
            stargazers_count: 120,
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "decline", {
      createdAt: "2026-06-01T00:00:00Z",
      description: "",
      fullName: "acme/decline",
      id: 102,
      language: null,
      owner: "acme",
      repo: "decline",
      stars: 100,
    });

    expect(result.history).toEqual([
      { date: "2026-06-01", stars: 0 },
      { date: "2026-07-10", stars: 120 },
      { date: TODAY, stars: 100 },
    ]);
  });

  it("preserves a same-day snapshot before the exact current decline", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("api.github.com/repos/acme/decline/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }
        if (url.includes("play.clickhouse.com")) {
          expect(String(init?.body ?? "")).toContain("github_repos_history");
          return jsonResponse({ data: [] });
        }
        if (url.includes("web.archive.org/cdx/search/cdx")) {
          return jsonResponse([
            ["timestamp", "original", "digest"],
            [
              "20260722100000",
              "https://api.github.com/repos/acme/decline",
              "capture-one",
            ],
          ]);
        }
        if (url.includes("web.archive.org/web/20260722100000id_")) {
          return jsonResponse({
            created_at: "2026-06-01T00:00:00Z",
            full_name: "acme/decline",
            id: 103,
            stargazers_count: 120,
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "decline", {
      createdAt: "2026-06-01T00:00:00Z",
      description: "",
      fullName: "acme/decline",
      id: 103,
      language: null,
      owner: "acme",
      repo: "decline",
      stars: 100,
    });

    expect(result.history).toEqual([
      { date: "2026-06-01", stars: 0 },
      { date: TODAY, stars: 120 },
      { date: "2026-07-22T12:00:00.000Z", stars: 100 },
    ]);
  });

  it("does not infer an absolute history from a capped recent-event tail", async () => {
    vi.setSystemTime(new Date("2026-08-02T21:00:00Z"));
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    const recentEvents = (date: string, count: number) =>
      Array.from({ length: count }, () => ({
        created_at: `${date}T12:00:00Z`,
        type: "WatchEvent",
      }));

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/launch/stargazers")) {
          return jsonResponse({ message: "Not Found" }, { status: 404 });
        }
        if (url.includes("play.clickhouse.com")) {
          const body = String(init?.body ?? "");
          if (body.includes("github_repos_history")) {
            return jsonResponse({ data: [] });
          }
          return jsonResponse({
            data: [
              { date: "2026-07-24", new_stars: 2 },
              { date: "2026-07-25", new_stars: 1 },
              { date: "2026-07-29", new_stars: 2 },
              { date: "2026-07-30", new_stars: 2 },
            ],
          });
        }
        if (url.includes("web.archive.org/cdx/search/cdx")) {
          return jsonResponse([["timestamp", "original", "digest"]]);
        }
        if (url.includes("api.github.com/repos/acme/launch/events")) {
          const page = Number(new URL(url).searchParams.get("page"));
          if (page === 1) {
            return jsonResponse(recentEvents("2026-08-02", 90));
          }
          if (page === 2) {
            return jsonResponse(recentEvents("2026-08-01", 70));
          }
          return jsonResponse(recentEvents("2026-07-31", 50));
        }
        if (url.includes("api.ossinsight.io")) {
          return jsonResponse({ data: { rows: [] } });
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "launch", {
      createdAt: "2026-07-16T13:38:20Z",
      description: "Launch",
      fullName: "acme/launch",
      id: 10,
      language: "TypeScript",
      owner: "acme",
      repo: "launch",
      stars: 3082,
    });

    expect(result.history).toEqual([
      { date: "2026-07-16", stars: 0 },
      { date: "2026-08-02", stars: 3082 },
    ]);
  });

  it("does not request recent-event pages for aggregate history", async () => {
    vi.setSystemTime(new Date("2026-08-02T21:00:00Z"));
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    const recentEvents = (date: string, count: number) =>
      Array.from({ length: count }, () => ({
        created_at: `${date}T12:00:00Z`,
        type: "WatchEvent",
      }));

    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/launch/stargazers")) {
          return jsonResponse({ message: "Not Found" }, { status: 404 });
        }
        if (url.includes("play.clickhouse.com")) {
          const body = String(init?.body ?? "");
          return jsonResponse({
            data: body.includes("github_repos_history")
              ? []
              : [{ date: "2026-07-30", new_stars: 2 }],
          });
        }
        if (url.includes("web.archive.org/cdx/search/cdx")) {
          return jsonResponse([["timestamp", "original", "digest"]]);
        }
        if (url.includes("api.github.com/repos/acme/launch/events")) {
          const page = Number(new URL(url).searchParams.get("page"));
          if (page === 2) {
            return jsonResponse(
              { message: "API rate limit exceeded" },
              { status: 429 }
            );
          }
          return jsonResponse([
            ...recentEvents("2026-07-31", 30),
            ...recentEvents("2026-08-01", 30),
            ...recentEvents("2026-08-02", 30),
          ]);
        }
        if (url.includes("api.ossinsight.io")) {
          return jsonResponse({ data: { rows: [] } });
        }
        throw new Error(`Unexpected request: ${url}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "launch", {
      createdAt: "2026-07-16T13:38:20Z",
      description: "Launch",
      fullName: "acme/launch",
      id: 10,
      language: "TypeScript",
      owner: "acme",
      repo: "launch",
      stars: 3082,
    });

    expect(result.history).toEqual([
      { date: "2026-07-16", stars: 0 },
      { date: "2026-08-02", stars: 3082 },
    ]);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        input.toString().includes("api.github.com/repos/acme/launch/events")
      )
    ).toHaveLength(0);
  });

  it("does not fill gaps between aggregate snapshots with sampled events", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }

        if (url.includes("play.clickhouse.com")) {
          const body = String(init?.body ?? "");
          if (body.includes("github_repos_history")) {
            return jsonResponse({
              data: [
                { date: "2026-01-01", stars: 100 },
                { date: "2026-02-01", stars: 200 },
                { date: "2026-03-01", stars: 300 },
              ],
            });
          }
          if (body.includes("github_events")) {
            return jsonResponse({
              data: [
                { date: "2025-12-20", new_stars: 20 },
                { date: "2026-01-05", new_stars: 50 },
                { date: "2026-04-01", new_stars: 30 },
                { date: "2026-06-01", new_stars: 70 },
              ],
            });
          }
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2025-12-01T00:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 8,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 500,
    });

    expect(result.estimated).toBe(true);
    expect(result.history).toEqual([
      { date: "2025-12-01", stars: 0 },
      { date: "2026-01-01", stars: 100 },
      { date: "2026-02-01", stars: 200 },
      { date: "2026-03-01", stars: 300 },
      { date: TODAY, stars: 500 },
    ]);
  });

  it("skips the event archive for repo names outside GitHub's charset", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }

        if (url.includes("play.clickhouse.com")) {
          const body = String(init?.body ?? "");
          if (body.includes("github_repos_history")) {
            return jsonResponse({ data: [] });
          }
        }

        if (url.includes("api.ossinsight.io")) {
          return jsonResponse({
            data: {
              rows: [
                { date: "2024-01-01", stargazers: "1" },
                { date: "2024-02-01", stargazers: "2" },
              ],
            },
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "wid'get", {
      createdAt: "2023-12-15T00:00:00Z",
      description: "",
      fullName: "acme/wid'get",
      id: 7,
      language: null,
      owner: "acme",
      repo: "wid'get",
      stars: 2,
    });

    const eventQueries = fetchMock.mock.calls.filter(([, init]) =>
      String(init?.body ?? "").includes("github_events")
    );
    expect(eventQueries).toHaveLength(0);
    expect(result.estimated).toBe(true);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 2 });
  });
});

describe("stars API route", () => {
  it("returns an estimated chart after GitHub denies stargazer access", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url === "https://api.github.com/repos/acme/widget") {
          return jsonResponse({
            created_at: "2023-12-15T00:00:00Z",
            description: "Widget",
            full_name: "acme/widget",
            id: 1,
            language: "TypeScript",
            stargazers_count: 2,
          });
        }

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }

        if (url.includes("api.ossinsight.io")) {
          return jsonResponse({
            data: {
              rows: [
                { date: "2024-01-01", stargazers: "1" },
                { date: "2024-02-01", stargazers: "2" },
              ],
            },
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { GET } = await import("@/app/api/stars/[owner]/[repo]/route");
    const response = await GET(
      new Request("http://localhost/api/stars/acme/widget") as NextRequest,
      { params: Promise.resolve({ owner: "acme", repo: "widget" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(json.estimated).toBe(true);
    expect(json.history).toHaveLength(2);
    expect(json.error).toBeUndefined();
  });

  it("does not expose GitHub's token error if the archive is unavailable", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url === "https://api.github.com/repos/acme/widget") {
          return jsonResponse({
            created_at: "2024-01-15T10:00:00Z",
            description: "Widget",
            full_name: "acme/widget",
            id: 2,
            language: "TypeScript",
            stargazers_count: 2,
          });
        }

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }

        return jsonResponse({ message: "Unavailable" }, { status: 503 });
      })
    );

    const { GET } = await import("@/app/api/stars/[owner]/[repo]/route");
    const response = await GET(
      new Request("http://localhost/api/stars/acme/widget") as NextRequest,
      { params: Promise.resolve({ owner: "acme", repo: "widget" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.estimated).toBe(true);
    expect(json.history.at(-1)).toEqual({ date: TODAY, stars: 2 });
    expect(json.error).toBeUndefined();
  });
});

describe("embed API route", () => {
  it("renders estimated observations at date-proportional positions", async () => {
    vi.setSystemTime(new Date("2026-07-22T12:00:00Z"));
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url === "https://api.github.com/repos/acme/widget") {
          return jsonResponse({
            created_at: "2026-07-01T00:00:00Z",
            description: "Widget",
            full_name: "acme/widget",
            id: 3,
            language: "TypeScript",
            stargazers_count: 4,
          });
        }

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse({ message: ACCESS_DENIED }, { status: 403 });
        }

        if (url.includes("play.clickhouse.com")) {
          expect(String(init?.body ?? "")).toContain("github_repos_history");
          return jsonResponse({
            data: [
              { date: "2026-07-02", stars: 1 },
              { date: "2026-07-11", stars: 2 },
            ],
          });
        }

        if (url.includes("web.archive.org/cdx/search/cdx")) {
          return jsonResponse([["timestamp", "original", "digest"]]);
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { GET } = await import("@/app/api/embed/route");
    const response = await GET(
      new Request(
        "http://localhost/api/embed?repo=acme/widget&theme=dark"
      ) as NextRequest
    );
    const svg = await response.text();

    expect(response.status).toBe(200);
    expect(svg).toContain(
      "Real observations · dashed gaps unknown · current total exact"
    );
    expect(svg).toContain(
      'aria-label="RepoStars embed for acme/widget (observed points with unknown gaps)"'
    );
    expect(svg).toContain('stroke-dasharray="6 7"');
    expect(svg).not.toContain("<polygon");
    expect(svg.match(/<circle /g)).toHaveLength(4);
    expect(svg).toContain("30.29,195.00");
    expect(svg).toContain("302.86,130.00");
    expect(svg).not.toContain("RepoStars embed error");
  });

  it("keeps exact histories solid and filled", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url === "https://api.github.com/repos/acme/widget") {
          return jsonResponse({
            created_at: "2026-07-01T00:00:00Z",
            description: "Widget",
            full_name: "acme/widget",
            id: 4,
            language: "TypeScript",
            stargazers_count: 3,
          });
        }

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse([
            { starred_at: "2026-07-02T00:00:00Z" },
            { starred_at: "2026-07-11T00:00:00Z" },
            { starred_at: "2026-07-22T00:00:00Z" },
          ]);
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const { GET } = await import("@/app/api/embed/route");
    const response = await GET(
      new Request(
        "http://localhost/api/embed?repo=acme/widget&theme=dark"
      ) as NextRequest
    );
    const svg = await response.text();

    expect(response.status).toBe(200);
    expect(svg).toContain("<polygon");
    expect(svg).not.toContain('stroke-dasharray="6 7"');
    expect(svg.match(/<circle /g)).toHaveLength(2);
  });
});

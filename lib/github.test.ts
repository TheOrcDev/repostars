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
  it("uses well-covered public history when GitHub blocks stargazers", async () => {
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
      { date: "2024-01-01", stars: 1 },
      { date: "2024-02-01", stars: 2 },
      { date: TODAY, stars: 2 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("uses aggregate snapshots to preserve a repository's real growth shape", async () => {
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
    expect(result.history).toContainEqual({
      date: "2025-04-23",
      stars: 237,
    });
    expect(result.history).toContainEqual({ date: "2025-12-31", stars: 1389 });
    expect(result.history).toHaveLength(10);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 1952 });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().includes("api.ossinsight.io")
      )
    ).toBe(false);
  });

  it("keeps a useful archive shape when aggregate snapshots are unavailable", async () => {
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

    expect(result.history).toContainEqual({
      date: "2025-04-07",
      stars: 394,
    });
    expect(result.history).toHaveLength(10);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 1952 });
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

  it("uses the public fallback when GitHub returns an empty restricted page", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.includes("api.github.com/repos/acme/widget/stargazers")) {
          return jsonResponse([]);
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
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 2 });
  });

  it("skips the stargazers probe and estimates when no token is configured", async () => {
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
      { date: "2026-07-06", stars: 220 },
      { date: "2026-07-10", stars: 396 },
      { date: TODAY, stars: 396 },
    ]);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().includes("api.github.com")
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

  it("repairs sparse snapshot head and stale tail with real star events", async () => {
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
      { date: "2025-12-20", stars: 100 },
      { date: "2026-01-01", stars: 100 },
      { date: "2026-02-01", stars: 200 },
      { date: "2026-03-01", stars: 300 },
      { date: "2026-04-01", stars: 360 },
      { date: "2026-06-01", stars: 500 },
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
    expect(json.history).toHaveLength(4);
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
  it("labels an estimated history in the generated SVG", async () => {
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
            id: 3,
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

    const { GET } = await import("@/app/api/embed/route");
    const response = await GET(
      new Request(
        "http://localhost/api/embed?repo=acme/widget&theme=dark"
      ) as NextRequest
    );
    const svg = await response.text();

    expect(response.status).toBe(200);
    expect(svg).toContain("Estimated history");
    expect(svg).not.toContain("RepoStars embed error");
  });
});

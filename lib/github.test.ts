import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Saturday, so the newest GitHub week (Sunday 2026-08-30) ends today.
const TODAY = "2026-09-05";
const NEWEST_WEEK = 1_788_048_000;
const WEEK_SECONDS = 7 * 24 * 60 * 60;
const REPO_INFO_URL = "https://api.github.com/repos/acme/widget";
const HISTORY_PATH = "/repos/acme/widget/stargazers/history";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

function repoInfoResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse({
    created_at: "2026-08-23T09:00:00Z",
    description: "Widget",
    full_name: "acme/widget",
    id: 1,
    language: "TypeScript",
    stargazers_count: 10,
    ...overrides,
  });
}

function historyResponse() {
  return jsonResponse([
    { days: [1, 0, 2, 0, 0, 0, 0], total: 3, week: NEWEST_WEEK },
    { days: [0, 3, 0, 0, 0, 0, 4], total: 7, week: NEWEST_WEEK - WEEK_SECONDS },
  ]);
}

function requestUrl(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input.toString());
}

const EXACT_HISTORY = [
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
  { date: TODAY, stars: 10 },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

describe("getStarHistoryResult", () => {
  it("returns exact daily history from GitHub's star history endpoint", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    const fetchMock = vi.fn(
      (input: string | URL | Request, _init?: RequestInit) => {
        const url = requestUrl(input);
        if (url.pathname === HISTORY_PATH) {
          return historyResponse();
        }
        throw new Error(`Unexpected request: ${url}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-08-23T09:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 1,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 10,
    });

    expect(result).toEqual({ estimated: false, history: EXACT_HISTORY });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "X-GitHub-Api-Version": "2026-03-10",
    });
  });

  it("works without a token", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetchMock = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) => historyResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-08-23T09:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 1,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 10,
    });

    expect(result.estimated).toBe(false);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).not.toHaveProperty("Authorization");
  });

  it("requests history under the canonical name for renamed repositories", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/repos/new-org/widget/stargazers/history") {
        return historyResponse();
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("old-org", "widget", {
      createdAt: "2026-08-23T09:00:00Z",
      description: "",
      fullName: "new-org/widget",
      id: 1,
      language: null,
      owner: "old-org",
      repo: "widget",
      stars: 10,
    });

    expect(result.estimated).toBe(false);
  });

  it("returns an empty history for repositories with no stars", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-08-23T09:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 1,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 0,
    });

    expect(result).toEqual({ estimated: false, history: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expands a repository in its first week into an hourly path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse([
          { days: [0, 0, 0, 0, 5, 80, 15], total: 100, week: NEWEST_WEEK },
        ])
      )
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2026-09-03T10:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 1,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 100,
    });

    expect(result.estimated).toBe(false);
    expect(result.history.length).toBeGreaterThan(40);
    expect(result.history[0]).toEqual({ date: "2026-09-02", stars: 0 });
    expect(
      result.history.find((point) => point.date === "2026-09-03")?.stars
    ).toBe(5);
    expect(
      result.history.find((point) => point.date === "2026-09-04")?.stars
    ).toBe(85);
    expect(result.history.at(-1)?.stars).toBe(100);
    expect(result.history.some((point) => point.date.includes("T"))).toBe(true);
  });

  it("falls back to a labelled estimate when GitHub rate limits the history endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({ message: "API rate limit exceeded" }, { status: 403 })
      )
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2024-01-15T10:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 1,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 10,
    });

    expect(result).toEqual({
      estimated: true,
      history: [
        { date: "2024-01-15", stars: 0 },
        { date: TODAY, stars: 10 },
      ],
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("GITHUB_TOKEN")
    );
  });

  it("falls back to an estimate on a malformed payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ message: "unexpected" }))
    );

    const { getStarHistoryResult } = await import("@/lib/github");
    const result = await getStarHistoryResult("acme", "widget", {
      createdAt: "2024-01-15T10:00:00Z",
      description: "",
      fullName: "acme/widget",
      id: 1,
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 10,
    });

    expect(result.estimated).toBe(true);
    expect(result.history.at(-1)).toEqual({ date: TODAY, stars: 10 });
  });
});

describe("stars API route", () => {
  it("returns an exact history with a long CDN cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.href === REPO_INFO_URL) {
          return repoInfoResponse();
        }
        if (url.pathname === HISTORY_PATH) {
          return historyResponse();
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
    expect(json.estimated).toBe(false);
    expect(json.history).toEqual(EXACT_HISTORY);
    expect(json.info.fullName).toBe("acme/widget");
    expect(json.error).toBeUndefined();
  });

  it("returns an estimated chart instead of an error when history is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.href === REPO_INFO_URL) {
          return repoInfoResponse();
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
    expect(json.history.at(-1)).toEqual({ date: TODAY, stars: 10 });
    expect(json.error).toBeUndefined();
  });

  it("returns 404 for an unknown repository", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ message: "Not Found" }, { status: 404 }))
    );

    const { GET } = await import("@/app/api/stars/[owner]/[repo]/route");
    const response = await GET(
      new Request("http://localhost/api/stars/acme/missing") as NextRequest,
      { params: Promise.resolve({ owner: "acme", repo: "missing" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 429 when repository metadata itself is rate limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({ message: "API rate limit exceeded" }, { status: 403 })
      )
    );

    const { GET } = await import("@/app/api/stars/[owner]/[repo]/route");
    const response = await GET(
      new Request("http://localhost/api/stars/acme/widget") as NextRequest,
      { params: Promise.resolve({ owner: "acme", repo: "widget" }) }
    );

    expect(response.status).toBe(429);
  });
});

describe("embed API route", () => {
  it("renders an exact history without the estimated label", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.href === REPO_INFO_URL) {
          return repoInfoResponse();
        }
        if (url.pathname === HISTORY_PATH) {
          return historyResponse();
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
    expect(svg).toContain("acme/widget");
    expect(svg).toContain("<polyline");
    expect(svg).not.toContain("Estimated history");
    expect(svg).not.toContain("RepoStars embed error");
  });

  it("labels an estimated history in the generated SVG", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.href === REPO_INFO_URL) {
          return repoInfoResponse({ created_at: "2024-01-15T10:00:00Z" });
        }
        return jsonResponse({ message: "Unavailable" }, { status: 503 });
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
    expect(svg).toContain("<polyline");
    expect(svg).not.toContain("RepoStars embed error");
  });
});

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
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 2,
    });

    expect(history).toEqual([
      { date: "2023-12-31", stars: 0 },
      { date: "2024-01-01", stars: 1 },
      { date: "2024-02-01", stars: 2 },
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
      createdAt: "2024-01-15T10:00:00Z",
      description: "",
      fullName: "acme/widget",
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 10,
    });

    expect(history).toEqual([
      { date: "2024-01-15", stars: 0 },
      { date: TODAY, stars: 10 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
      language: null,
      owner: "acme",
      repo: "widget",
      stars: 2,
    });

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

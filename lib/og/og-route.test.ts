import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TODAY = "2026-09-05";
const NEWEST_WEEK = 1_788_048_000;
const realFetch = globalThis.fetch;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

function githubMock() {
  return vi.fn((input: string | URL | Request) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString()
    );
    if (url.protocol === "data:") {
      // Satori loads its resvg wasm through fetch.
      return realFetch(input);
    }
    if (url.hostname !== "api.github.com") {
      return Promise.reject(
        new Error(`Unexpected non-GitHub request during render: ${url}`)
      );
    }
    if (url.pathname === "/repos/acme/widget") {
      return Promise.resolve(
        jsonResponse({
          created_at: "2026-08-23T09:00:00Z",
          description: "A widget for everything",
          full_name: "acme/widget",
          id: 1,
          language: "TypeScript",
          stargazers_count: 10,
        })
      );
    }
    if (url.pathname === "/repos/acme/widget/stargazers/history") {
      return Promise.resolve(
        jsonResponse([
          { days: [1, 0, 2, 0, 0, 0, 0], total: 3, week: NEWEST_WEEK },
        ])
      );
    }
    return Promise.resolve(
      jsonResponse({ message: "Not Found" }, { status: 404 })
    );
  });
}

async function renderOg(query: string) {
  const { GET } = await import("@/app/api/og/route");
  return GET(new Request(`http://localhost/api/og?${query}`) as NextRequest);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

describe("OG image route", () => {
  it("renders a PNG with a day-long cache for a loaded repository", async () => {
    vi.stubGlobal("fetch", githubMock());

    const response = await renderOg("repos=acme/widget&theme=terminal");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it("renders the fallback card with a short cache when every repo fails", async () => {
    vi.stubGlobal("fetch", githubMock());

    const response = await renderOg("repos=acme/missing&theme=8bit");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("renders a mixed comparison when one repo is unavailable", async () => {
    vi.stubGlobal("fetch", githubMock());

    const response = await renderOg(
      "repos=acme/widget,acme/missing&theme=light"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("renders the brand card without repos", async () => {
    vi.stubGlobal("fetch", githubMock());

    const response = await renderOg("");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });
});

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

async function renderExport(query: string) {
  const { GET } = await import("@/app/api/export/route");
  return GET(
    new Request(`http://localhost/api/export?${query}`) as NextRequest
  );
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  return { height: view.getUint32(20), width: view.getUint32(16) };
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

describe("PNG export route", () => {
  it("renders a 2x attachment for a loaded repository", async () => {
    vi.stubGlobal("fetch", githubMock());

    const response = await renderExport("repos=acme/widget&theme=dark");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="repostars-acme-widget.png"'
    );
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(pngSize(await response.arrayBuffer())).toEqual({
      height: 1260,
      width: 2400,
    });
  });

  it("returns a JSON error instead of the brand card when every repo fails", async () => {
    vi.stubGlobal("fetch", githubMock());

    const response = await renderExport("repos=acme/missing&theme=dark");

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Star history could not be loaded right now.",
    });
  });

  it("rejects a request without repositories", async () => {
    vi.stubGlobal("fetch", githubMock());

    const response = await renderExport("theme=dark");

    expect(response.status).toBe(400);
  });
});

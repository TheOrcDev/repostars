import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getRepoInfo } from "@/lib/github";
import { defaultTheme, themes } from "@/lib/themes";

function formatStars(n: number) {
  return n.toLocaleString("en-US");
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 1200
): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs)
      ),
    ]);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reposParam = searchParams.get("repos") || "";
  const themeId = searchParams.get("theme") || defaultTheme;
  const theme = themes[themeId] || themes[defaultTheme];

  const repos = reposParam.split(",").filter(Boolean).slice(0, 3);

  const loaded = await Promise.all(
    repos.map((fullName) => {
      const [owner, repo] = fullName.split("/");
      if (!(owner && repo)) {
        return Promise.resolve(null);
      }
      return withTimeout(getRepoInfo(owner, repo), 1200);
    })
  );

  const rows = (
    loaded
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        fullName: r.fullName,
        stars: r.stars,
      })) || []
  ).slice(0, 3);

  const largestStarTotal = Math.max(1, ...rows.map((repo) => repo.stars));
  const comparisonLabel =
    rows.length > 0
      ? `Current GitHub star totals: ${rows
          .map((repo) => `${repo.fullName}, ${repo.stars} stars`)
          .join("; ")}`
      : "Current GitHub star totals are unavailable";

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background: theme.background,
        color: theme.textColor,
        padding: 56,
        fontFamily: "Inter, Arial, sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.15,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* biome-ignore lint/performance/noImgElement: next/og ImageResponse requires standard img */}
          <img
            alt="RepoStars logo"
            height={42}
            src={new URL("/repostars-logo.png", req.url).toString()}
            style={{ borderRadius: 10 }}
            width={42}
          />
          <div style={{ fontSize: 56, fontWeight: 800, color: "#fff" }}>
            RepoStars
          </div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.8 }}>repostars.dev</div>
      </div>

      <div style={{ zIndex: 1, marginTop: 16, fontSize: 30, opacity: 0.88 }}>
        Current GitHub stars for selected repositories
      </div>

      <div
        aria-label={comparisonLabel}
        role="img"
        style={{
          zIndex: 1,
          marginTop: 30,
          border: `1px solid ${theme.gridColor}`,
          borderRadius: 16,
          padding: 24,
          background: "rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <span style={{ color: "#fff", fontSize: 23, fontWeight: 700 }}>
            Current star totals
          </span>
          <span style={{ color: theme.textColor, fontSize: 15, opacity: 0.82 }}>
            Bar length is relative to the largest selection
          </span>
        </div>

        {rows.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {rows.map((repo, i) => (
              <div
                key={repo.fullName}
                style={{
                  background: "rgba(255,255,255,0.035)",
                  border: `1px solid ${theme.gridColor}`,
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      color: "#fff",
                      display: "flex",
                      fontSize: 21,
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        background:
                          theme.lineColors[i % theme.lineColors.length],
                        borderRadius: 999,
                        height: 11,
                        width: 11,
                      }}
                    />
                    <span>{repo.fullName}</span>
                  </div>
                  <span
                    style={{
                      color: theme.lineColors[i % theme.lineColors.length],
                      fontSize: 23,
                      fontWeight: 700,
                    }}
                  >
                    {formatStars(repo.stars)} stars
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  style={{
                    background: `${theme.gridColor}55`,
                    borderRadius: 999,
                    display: "flex",
                    height: 13,
                    overflow: "hidden",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      background: theme.lineColors[i % theme.lineColors.length],
                      borderRadius: 999,
                      height: "100%",
                      width: `${(repo.stars / largestStarTotal) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              alignItems: "center",
              color: theme.textColor,
              display: "flex",
              flexDirection: "column",
              fontSize: 22,
              gap: 8,
              justifyContent: "center",
              minHeight: 220,
            }}
          >
            <span style={{ color: "#fff", fontWeight: 700 }}>
              Repository totals unavailable
            </span>
            <span style={{ fontSize: 17, opacity: 0.78 }}>
              Open RepoStars to refresh this comparison.
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: "auto" }} />
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}

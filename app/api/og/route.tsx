import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getRepoInfo } from "@/lib/github";
import { themes, defaultTheme } from "@/lib/themes";

function formatStars(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 1200): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
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
    repos.map(async (fullName) => {
      const [owner, repo] = fullName.split("/");
      if (!owner || !repo) return null;
      return withTimeout(getRepoInfo(owner, repo), 1200);
    })
  );

  const rows = (loaded.filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => ({
    fullName: r.fullName,
    stars: r.stars,
  })) || []).slice(0, 3);

  const displayRows = rows.length
    ? rows
    : [
        { fullName: "shadcn-ui/ui", stars: 0 },
        { fullName: "47ng/nuqs", stars: 0 },
        { fullName: "tailwindlabs/tailwindcss", stars: 0 },
      ];

  return new ImageResponse(
    (
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: theme.lineColors[0],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 700,
                color: theme.background,
              }}
            >
              ★
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, color: "#fff" }}>RepoStars</div>
          </div>
          <div style={{ fontSize: 24, opacity: 0.8 }}>repostars.dev</div>
        </div>

        <div style={{ zIndex: 1, marginTop: 16, fontSize: 30, opacity: 0.88 }}>
          Compare GitHub star history with beautiful themed charts
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 34, zIndex: 1 }}>
          {displayRows.map((repo, i) => (
            <div
              key={repo.fullName}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${theme.gridColor}`,
                borderRadius: 14,
                padding: "14px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: theme.lineColors[i % theme.lineColors.length],
                  }}
                />
                <div style={{ fontSize: 30, color: "#fff", fontWeight: 600 }}>{repo.fullName}</div>
              </div>
              <div style={{ fontSize: 30, color: theme.lineColors[i % theme.lineColors.length], fontWeight: 700 }}>
                ★ {formatStars(repo.stars)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ zIndex: 1, marginTop: "auto", fontSize: 22, opacity: 0.75 }}>
          Live data • Theme: {theme.name || "Dark"}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}

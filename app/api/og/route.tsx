import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getRepoInfo } from "@/lib/github";
import { defaultTheme, themes } from "@/lib/themes";

function formatStars(n: number) {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return `${n}`;
}

function hashSeed(input: string) {
  let h = 2_166_136_261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return Math.abs(h >>> 0);
}

function makeSeries(
  stars: number,
  seed: number,
  points = 24,
  curvePower = 1.7,
  noiseAmp = 0.04
) {
  const out: number[] = [];
  const max = Math.max(1, stars);
  const base = max * 0.02;

  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const growth = t ** curvePower;
    const noise = (((seed >> (i % 16)) & 15) / 15 - 0.5) * noiseAmp;
    const v = Math.max(
      0,
      Math.round((base + (max - base) * growth) * (1 + noise))
    );
    out.push(v);
  }
  out[points - 1] = max;

  // enforce monotonic increase for chart sanity
  for (let i = 1; i < out.length; i++) {
    if (out[i] < out[i - 1]) {
      out[i] = out[i - 1];
    }
  }
  return out;
}

function toPolyline(
  values: number[],
  width: number,
  height: number,
  maxY: number
) {
  if (!values.length) {
    return "";
  }
  const denom = Math.max(1, values.length - 1);
  return values
    .map((v, i) => {
      const x = (i / denom) * width;
      const y = height - (v / Math.max(1, maxY)) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
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
    repos.map(async (fullName) => {
      const [owner, repo] = fullName.split("/");
      if (!(owner && repo)) {
        return null;
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
        seed: hashSeed(r.fullName),
      })) || []
  ).slice(0, 3);

  const displayRows = rows.length
    ? rows
    : [
        {
          fullName: "shadcn-ui/ui",
          stars: 116_000,
          seed: hashSeed("shadcn-ui/ui"),
        },
        { fullName: "47ng/nuqs", stars: 4900, seed: hashSeed("47ng/nuqs") },
        {
          fullName: "tailwindlabs/tailwindcss",
          stars: 89_000,
          seed: hashSeed("tailwindlabs/tailwindcss"),
        },
      ];

  const chartW = 1020;
  const chartH = 250;

  const curveByTheme: Record<string, { power: number; noise: number }> = {
    terminal: { power: 2.2, noise: 0.025 },
    neon: { power: 1.55, noise: 0.05 },
    synthwave: { power: 1.45, noise: 0.055 },
    minimal: { power: 1.85, noise: 0.02 },
  };
  const curve = curveByTheme[themeId] ?? { power: 1.7, noise: 0.04 };

  const withSeries = displayRows.map((r) => ({
    ...r,
    series: makeSeries(r.stars, r.seed, 24, curve.power, curve.noise),
  }));
  const yMax = Math.max(1, ...withSeries.flatMap((r) => r.series));
  const yMid = Math.round(yMax / 2);

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
        Star history preview for selected repositories
      </div>

      <div
        style={{
          zIndex: 1,
          marginTop: 36,
          border: `1px solid ${theme.gridColor}`,
          borderRadius: 16,
          padding: 18,
          background: "rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <svg height={300} viewBox="0 0 1080 300" width={1080}>
          <g transform="translate(50,18)">
            <line
              stroke={theme.axisColor}
              strokeWidth="1"
              x1="0"
              x2={chartW}
              y1={chartH}
              y2={chartH}
            />
            <line
              stroke={theme.gridColor}
              strokeDasharray="4 4"
              strokeWidth="1"
              x1="0"
              x2={chartW}
              y1={Math.round(chartH / 2)}
              y2={Math.round(chartH / 2)}
            />
            <line
              stroke={theme.gridColor}
              strokeDasharray="4 4"
              strokeWidth="1"
              x1="0"
              x2={chartW}
              y1="0"
              y2="0"
            />

            {/* Y-axis labels on the left */}
            <text
              fill={theme.textColor}
              fontSize="13"
              opacity="0.9"
              textAnchor="end"
              x="-10"
              y="6"
            >
              {formatStars(yMax)}
            </text>
            <text
              fill={theme.textColor}
              fontSize="13"
              opacity="0.9"
              textAnchor="end"
              x="-10"
              y={Math.round(chartH / 2) + 4}
            >
              {formatStars(yMid)}
            </text>
            <text
              fill={theme.textColor}
              fontSize="13"
              opacity="0.9"
              textAnchor="end"
              x="-10"
              y={chartH + 4}
            >
              0
            </text>

            {withSeries.map((repo, i) => (
              <polyline
                fill="none"
                key={repo.fullName}
                points={toPolyline(repo.series, chartW, chartH, yMax)}
                stroke={theme.lineColors[i % theme.lineColors.length]}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
            ))}
          </g>
        </svg>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: theme.textColor,
            fontSize: 14,
            paddingLeft: 52,
            paddingRight: 12,
          }}
        >
          <span>Start</span>
          <span>Middle</span>
          <span>Now</span>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {withSeries.map((repo, i) => (
            <div
              key={repo.fullName}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: theme.lineColors[i % theme.lineColors.length],
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#fff",
                  fontSize: 20,
                }}
              >
                <span>{repo.fullName}</span>
                <span
                  style={{
                    color: theme.lineColors[i % theme.lineColors.length],
                  }}
                >
                  ({formatStars(repo.stars)})
                </span>
              </div>
            </div>
          ))}
        </div>
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

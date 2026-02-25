import { NextRequest, NextResponse } from "next/server";
import { getRepoDataCached } from "@/lib/repo-cache";
import { themes, defaultTheme } from "@/lib/themes";

function formatStars(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSparkline(values: number[], width: number, height: number) {
  if (values.length < 2) return { line: "", area: "" };
  const min = 0;
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const line = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const area = `${line} ${width},${height} 0,${height}`;

  return { line, area };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo") || "";
  const themeId = searchParams.get("theme") || defaultTheme;

  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    return new NextResponse("Missing repo=owner/repo", { status: 400 });
  }

  try {
    const { info, history } = await getRepoDataCached(owner, name);
    const theme = themes[themeId] || themes[defaultTheme];

    const series = history.slice(-90);
    const values = series.map((d) => d.stars);
    const { line, area } = buildSparkline(values, 500, 100);

    const yMax = Math.max(...values, info.stars);
    const yMid = Math.round(yMax / 2);

    const startDate = series[0]?.date ?? "";
    const midDate = series[Math.floor(series.length / 2)]?.date ?? "";
    const endDate = series[series.length - 1]?.date ?? "";

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="240" viewBox="0 0 700 240" role="img" aria-label="RepoStars embed for ${esc(info.fullName)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.lineColors[0]}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${theme.lineColors[0]}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="700" height="240" fill="${theme.background}" rx="14"/>
  <rect x="1" y="1" width="698" height="238" fill="none" stroke="${theme.gridColor}" rx="13"/>

  <text x="24" y="38" fill="${theme.textColor}" font-family="Inter,Segoe UI,Arial" font-size="18" font-weight="600">${esc(info.fullName)}</text>
  <text x="24" y="66" fill="${theme.lineColors[0]}" font-family="Inter,Segoe UI,Arial" font-size="26" font-weight="700">★ ${formatStars(info.stars)}</text>

  <g transform="translate(120,82)">
    <line x1="0" y1="0" x2="0" y2="110" stroke="${theme.gridColor}"/>
    <line x1="0" y1="110" x2="500" y2="110" stroke="${theme.gridColor}"/>
    <line x1="0" y1="55" x2="500" y2="55" stroke="${theme.gridColor}" stroke-dasharray="4 4"/>
    <line x1="0" y1="0" x2="500" y2="0" stroke="${theme.gridColor}" stroke-dasharray="4 4"/>

    <text x="-10" y="4" text-anchor="end" fill="${theme.textColor}" font-family="Inter,Segoe UI,Arial" font-size="11" opacity="0.9">${formatStars(yMax)}</text>
    <text x="-10" y="59" text-anchor="end" fill="${theme.textColor}" font-family="Inter,Segoe UI,Arial" font-size="11" opacity="0.9">${formatStars(yMid)}</text>
    <text x="-10" y="114" text-anchor="end" fill="${theme.textColor}" font-family="Inter,Segoe UI,Arial" font-size="11" opacity="0.9">0</text>

    ${line ? `<polygon points="${area}" fill="url(#g)"/>` : ""}
    ${line ? `<polyline points="${line}" fill="none" stroke="${theme.lineColors[0]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ""}

    <text x="0" y="128" fill="${theme.textColor}" font-family="Inter,Segoe UI,Arial" font-size="10" opacity="0.8">${esc(startDate)}</text>
    <text x="250" y="128" text-anchor="middle" fill="${theme.textColor}" font-family="Inter,Segoe UI,Arial" font-size="10" opacity="0.8">${esc(midDate)}</text>
    <text x="500" y="128" text-anchor="end" fill="${theme.textColor}" font-family="Inter,Segoe UI,Arial" font-size="10" opacity="0.8">${esc(endDate)}</text>
  </g>

  <text x="676" y="222" text-anchor="end" fill="${theme.textColor}" font-family="Inter,Segoe UI,Arial" font-size="12" opacity="0.8">Powered by repostars.dev</text>
</svg>`;

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="640" height="180"><rect width="100%" height="100%" fill="#111"/><text x="20" y="40" fill="#fff" font-family="Arial" font-size="18">RepoStars embed error</text><text x="20" y="70" fill="#aaa" font-family="Arial" font-size="14">${esc(
        e instanceof Error ? e.message : "Unknown error"
      )}</text></svg>`,
      {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, s-maxage=60",
        },
      }
    );
  }
}

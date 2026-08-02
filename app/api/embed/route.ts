import { type NextRequest, NextResponse } from "next/server";
import { getRepoData } from "@/lib/repo-cache";
import { defaultTheme, themes } from "@/lib/themes";

function formatStars(n: number) {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toString();
}

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface TimelineObservation {
  date: string;
  dateMs: number;
  stars: number;
  x: string;
  y: string;
}

function buildTimeline(
  history: Array<{ date: string; stars: number }>,
  width: number,
  height: number,
  currentStars: number
) {
  const source = history
    .flatMap((point) => {
      const dateMs = new Date(point.date).getTime();
      return Number.isFinite(dateMs) && Number.isFinite(point.stars)
        ? [{ date: point.date, dateMs, stars: point.stars }]
        : [];
    })
    .toSorted((a, b) => a.dateMs - b.dateMs);
  const firstDateMs = source[0]?.dateMs ?? 0;
  const lastDateMs = source.at(-1)?.dateMs ?? firstDateMs;
  const dateRange = lastDateMs - firstDateMs;
  const yMax = Math.max(1, currentStars, ...source.map((point) => point.stars));

  const points: TimelineObservation[] = source.map((point) => {
    const x =
      dateRange > 0
        ? ((point.dateMs - firstDateMs) / dateRange) * width
        : width / 2;
    const y = height - (point.stars / yMax) * height;
    return {
      ...point,
      x: x.toFixed(2),
      y: y.toFixed(2),
    };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area =
    points.length >= 2 ? `${line} ${width},${height} 0,${height}` : "";

  return { area, line, points, yMax };
}

function formatDateLabel(dateMs: number | undefined) {
  return dateMs == null ? "" : new Date(dateMs).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo") || "";
  const themeId = searchParams.get("theme") || defaultTheme;

  const [owner, name] = repo.split("/");
  if (!(owner && name)) {
    return new NextResponse("Missing repo=owner/repo", { status: 400 });
  }

  try {
    const { estimated, info, history, source } = await getRepoData(owner, name);
    const theme = themes[themeId] || themes[defaultTheme];

    const plotX = 44;
    const plotY = 98;
    const plotW = 636;
    const plotH = 260;

    const { line, area, points, yMax } = buildTimeline(
      history,
      plotW,
      plotH,
      info.stars
    );
    const yMid = Math.round(yMax / 2);
    const firstPoint = points[0];
    const lastPoint = points.at(-1);
    const startDate = formatDateLabel(firstPoint?.dateMs);
    const endDate = formatDateLabel(lastPoint?.dateMs);
    const midDate = formatDateLabel(
      firstPoint && lastPoint
        ? firstPoint.dateMs + (lastPoint.dateMs - firstPoint.dateMs) / 2
        : undefined
    );
    const markerPoints =
      estimated && source === "public-snapshots"
        ? points
        : [firstPoint, lastPoint].filter(
            (point, index, candidates): point is TimelineObservation =>
              point !== undefined && candidates.indexOf(point) === index
          );
    const markers = markerPoints
      .map((point) => {
        const isLast = point === lastPoint;
        return `<circle cx="${point.x}" cy="${point.y}" r="${isLast ? 5 : 4}" fill="${isLast ? theme.lineColors[0] : theme.background}" stroke="${theme.lineColors[0]}" stroke-width="2"/>`;
      })
      .join("\n    ");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="420" viewBox="0 0 700 420" role="img" aria-label="RepoStars embed for ${esc(info.fullName)}${estimated ? " (observed points with unknown gaps)" : ""}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.lineColors[0]}" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="${theme.lineColors[0]}" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${theme.lineColors[0]}" flood-opacity="0.34"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="700" height="420" fill="${theme.background}" rx="14"/>
  <rect x="1" y="1" width="698" height="418" fill="none" stroke="${theme.gridColor}" rx="13"/>

  <text x="22" y="36" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="17" font-weight="600">${esc(info.fullName)}</text>

  <text x="678" y="37" text-anchor="end" fill="${theme.lineColors[0]}" font-family="Geist, Inter, Segoe UI, Arial" font-size="20" font-weight="700">★ ${formatStars(info.stars)}</text>

  ${estimated ? `<text x="22" y="64" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="12" opacity="0.82">Real observations · dashed gaps unknown · current total exact</text>` : ""}

  <g transform="translate(${plotX},${plotY})">
    <line x1="0" y1="0" x2="0" y2="${plotH}" stroke="${theme.gridColor}" opacity="0.72"/>
    <line x1="0" y1="${plotH}" x2="${plotW}" y2="${plotH}" stroke="${theme.gridColor}" opacity="0.72"/>
    <line x1="0" y1="${Math.round(plotH / 2)}" x2="${plotW}" y2="${Math.round(plotH / 2)}" stroke="${theme.gridColor}" stroke-dasharray="4 4" opacity="0.72"/>
    <line x1="0" y1="0" x2="${plotW}" y2="0" stroke="${theme.gridColor}" stroke-dasharray="4 4" opacity="0.72"/>

    <text x="-10" y="4" text-anchor="end" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="10" opacity="0.95">${formatStars(yMax)}</text>
    <text x="-10" y="${Math.round(plotH / 2) + 4}" text-anchor="end" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="10" opacity="0.95">${formatStars(yMid)}</text>
    <text x="-10" y="${plotH + 4}" text-anchor="end" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="10" opacity="0.95">0</text>

    ${!estimated && area ? `<polygon points="${area}" fill="url(#g)"/>` : ""}
    ${points.length >= 2 ? `<polyline points="${line}" fill="none" filter="url(#soft-glow)" stroke="${theme.lineColors[0]}" stroke-width="3"${estimated ? ' stroke-dasharray="6 7"' : ""} stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${markers}

    <text x="0" y="${plotH + 20}" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="10" opacity="0.82">${esc(startDate)}</text>
    <text x="${Math.round(plotW / 2)}" y="${plotH + 20}" text-anchor="middle" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="10" opacity="0.82">${esc(midDate)}</text>
    <text x="${plotW}" y="${plotH + 20}" text-anchor="end" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="10" opacity="0.82">${esc(endDate)}</text>
  </g>

  <text x="676" y="402" text-anchor="end" fill="${theme.textColor}" font-family="Geist, Inter, Segoe UI, Arial" font-size="12" opacity="0.82">Powered by repostars.dev</text>
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

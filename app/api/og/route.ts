import { NextRequest, NextResponse } from "next/server";
import { getRepoInfo } from "@/lib/github";
import { themes, defaultTheme } from "@/lib/themes";

function formatStars(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  const validRepos = loaded.filter((r): r is NonNullable<typeof r> => Boolean(r));
  const rows = (validRepos.length
    ? validRepos.map((r) => ({ fullName: r.fullName, stars: r.stars }))
    : [
        { fullName: "shadcn-ui/ui", stars: 0 },
        { fullName: "47ng/nuqs", stars: 0 },
        { fullName: "tailwindlabs/tailwindcss", stars: 0 },
      ]
  ).slice(0, 3);

  const chips = rows
    .map(
      (repo, i) => `
      <g transform="translate(56, ${178 + i * 108})">
        <rect x="0" y="0" width="1088" height="84" rx="14" fill="rgba(255,255,255,0.06)" stroke="${theme.gridColor}" />
        <circle cx="24" cy="42" r="6" fill="${theme.lineColors[i % theme.lineColors.length]}" />
        <text x="42" y="50" fill="#ffffff" font-family="Inter,Segoe UI,Arial" font-size="30" font-weight="600">${esc(repo.fullName)}</text>
        <text x="1060" y="50" text-anchor="end" fill="${theme.lineColors[i % theme.lineColors.length]}" font-family="Inter,Segoe UI,Arial" font-size="30" font-weight="700">★ ${formatStars(repo.stars)}</text>
      </g>`
    )
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="RepoStars OG">
  <rect width="1200" height="630" fill="${theme.background}"/>
  <rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    </pattern>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#grid)" opacity="0.25"/>

  <g transform="translate(56,58)">
    <rect x="0" y="0" width="42" height="42" rx="10" fill="${theme.lineColors[0]}"/>
    <text x="10" y="30" font-size="24" font-family="Inter,Segoe UI,Arial" font-weight="700" fill="${theme.background}">★</text>
    <text x="56" y="34" font-size="56" font-family="Inter,Segoe UI,Arial" font-weight="800" fill="#ffffff">RepoStars</text>
    <text x="1088" y="34" text-anchor="end" font-size="24" font-family="Inter,Segoe UI,Arial" fill="${theme.textColor}" opacity="0.9">repostars.dev</text>
    <text x="0" y="82" font-size="28" font-family="Inter,Segoe UI,Arial" fill="${theme.textColor}" opacity="0.9">Compare GitHub star history with beautiful themed charts</text>
  </g>

  ${chips}

  <text x="56" y="600" font-size="20" font-family="Inter,Segoe UI,Arial" fill="${theme.textColor}" opacity="0.8">Live data • Theme: ${esc(theme.name || "Dark")}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

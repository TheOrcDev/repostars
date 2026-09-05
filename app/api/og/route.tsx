import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import {
  buildOgChart,
  isLoadedRepo,
  loadOgRepos,
  parseOgRepoNames,
} from "@/lib/og/load-og-repos";
import { OG_HEIGHT, OG_WIDTH, OgCard, OgFallbackCard } from "@/lib/og/og-card";
import { loadOgFonts } from "@/lib/og/og-fonts";
import { defaultTheme, themes } from "@/lib/themes";

// Star counts drift by a handful per day; a day-old preview is fine and
// keeps GitHub traffic from link crawlers negligible.
const CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";
const FALLBACK_CACHE_CONTROL = "public, s-maxage=300";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const names = parseOgRepoNames(searchParams.get("repos"));
  const themeId = searchParams.get("theme") || defaultTheme;
  const theme = themes[themeId] || themes[defaultTheme];

  const fontsPromise = loadOgFonts(theme.id);

  try {
    const [repos, fonts] = await Promise.all([
      names.length > 0 ? loadOgRepos(names) : Promise.resolve([]),
      fontsPromise,
    ]);
    const loaded = repos.filter(isLoadedRepo);

    if (loaded.length === 0) {
      return new ImageResponse(
        <OgFallbackCard fonts={fonts} names={names} theme={theme} />,
        {
          fonts: fonts.fonts,
          headers: {
            "Cache-Control":
              names.length > 0 ? FALLBACK_CACHE_CONTROL : CACHE_CONTROL,
          },
          height: OG_HEIGHT,
          width: OG_WIDTH,
        }
      );
    }

    const chart = buildOgChart(loaded, theme);
    const allLoaded = loaded.length === repos.length;

    return new ImageResponse(
      <OgCard chart={chart} fonts={fonts} repos={repos} theme={theme} />,
      {
        fonts: fonts.fonts,
        headers: {
          "Cache-Control": allLoaded ? CACHE_CONTROL : FALLBACK_CACHE_CONTROL,
        },
        height: OG_HEIGHT,
        width: OG_WIDTH,
      }
    );
  } catch (error) {
    console.error("OG image render failed", error);
    const fonts = await fontsPromise;
    return new ImageResponse(
      <OgFallbackCard fonts={fonts} names={names} theme={theme} />,
      {
        fonts: fonts.fonts,
        headers: { "Cache-Control": FALLBACK_CACHE_CONTROL },
        height: OG_HEIGHT,
        width: OG_WIDTH,
      }
    );
  }
}

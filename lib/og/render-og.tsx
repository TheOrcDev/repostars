import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import {
  buildOgChart,
  isLoadedRepo,
  loadOgRepos,
  parseOgRepoNames,
} from "@/lib/og/load-og-repos";
import { OG_HEIGHT, OG_WIDTH, OgCard, OgFallbackCard } from "@/lib/og/og-card";
import { loadOgFonts, type OgFontSet } from "@/lib/og/og-fonts";
import { type ChartTheme, defaultTheme, themes } from "@/lib/themes";

// Star counts drift by a handful per day; a day-old image is fine and keeps
// GitHub traffic from link crawlers and downloads negligible.
export const OG_CACHE_CONTROL =
  "public, s-maxage=86400, stale-while-revalidate=604800";
export const OG_FALLBACK_CACHE_CONTROL = "public, s-maxage=300";

export type OgScale = 1 | 2;

export interface RenderOgOptions {
  /**
   * What to return when no repository loads: the branded card (share
   * previews) or a JSON error (downloads must never save the wrong image).
   */
  fallback: "card" | "error";
  /** Extra headers merged into successful responses. */
  headers?: Record<string, string>;
  names: string[];
  scale?: OgScale;
  themeId: string;
}

export function resolveOgTheme(themeId: string | null | undefined): ChartTheme {
  return themes[themeId || defaultTheme] || themes[defaultTheme];
}

export function parseOgRequest(url: string) {
  const { searchParams } = new URL(url);
  return {
    names: parseOgRepoNames(searchParams.get("repos")),
    themeId: resolveOgTheme(searchParams.get("theme")).id,
  };
}

/**
 * Satori renders at layout size, so a 2x image wraps the 1200×630 card in a
 * scaled container inside a 2400×1260 frame. Text and SVG stay vector until
 * rasterisation, so the result is crisp without touching card constants.
 */
function scaled(
  card: ReactElement,
  scale: OgScale,
  background: string
): ReactElement {
  if (scale === 1) {
    return card;
  }
  return (
    <div
      style={{
        background,
        display: "flex",
        height: OG_HEIGHT * scale,
        width: OG_WIDTH * scale,
      }}
    >
      <div
        style={{
          display: "flex",
          height: OG_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: OG_WIDTH,
        }}
      >
        {card}
      </div>
    </div>
  );
}

function imageResponse(
  card: ReactElement,
  fonts: OgFontSet,
  theme: ChartTheme,
  scale: OgScale,
  headers: Record<string, string>
) {
  return new ImageResponse(scaled(card, scale, theme.background), {
    fonts: fonts.fonts,
    headers,
    height: OG_HEIGHT * scale,
    width: OG_WIDTH * scale,
  });
}

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { headers: { "Cache-Control": "no-store" }, status }
  );
}

export async function renderOg({
  fallback,
  headers = {},
  names,
  scale = 1,
  themeId,
}: RenderOgOptions): Promise<Response> {
  const theme = resolveOgTheme(themeId);
  const fontsPromise = loadOgFonts(theme.id);

  try {
    const [repos, fonts] = await Promise.all([
      names.length > 0 ? loadOgRepos(names) : Promise.resolve([]),
      fontsPromise,
    ]);
    const loaded = repos.filter(isLoadedRepo);

    if (loaded.length === 0) {
      if (fallback === "error") {
        return errorResponse(
          names.length > 0
            ? "Star history could not be loaded right now."
            : "No repositories requested.",
          names.length > 0 ? 502 : 400
        );
      }
      return imageResponse(
        <OgFallbackCard fonts={fonts} names={names} theme={theme} />,
        fonts,
        theme,
        scale,
        {
          "Cache-Control":
            names.length > 0 ? OG_FALLBACK_CACHE_CONTROL : OG_CACHE_CONTROL,
        }
      );
    }

    const chart = buildOgChart(loaded, theme);
    const allLoaded = loaded.length === repos.length;

    return imageResponse(
      <OgCard chart={chart} fonts={fonts} repos={repos} theme={theme} />,
      fonts,
      theme,
      scale,
      {
        "Cache-Control": allLoaded
          ? OG_CACHE_CONTROL
          : OG_FALLBACK_CACHE_CONTROL,
        ...headers,
      }
    );
  } catch (error) {
    console.error("OG image render failed", error);
    if (fallback === "error") {
      return errorResponse("The chart image could not be rendered.", 500);
    }
    const fonts = await fontsPromise;
    return imageResponse(
      <OgFallbackCard fonts={fonts} names={names} theme={theme} />,
      fonts,
      theme,
      scale,
      { "Cache-Control": OG_FALLBACK_CACHE_CONTROL }
    );
  }
}

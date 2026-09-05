# Plan: dynamic OG image that shows the real chart

> Status: implemented 2026-09-05. Modules live in `lib/og/`; render the
> review matrix with `pnpm og:preview` (see `scripts/render-og-matrix.mts`).

Goal: when someone shares `https://www.repostars.dev/?repos=47ng/nuqs&theme=terminal`,
the link preview on X, Slack, Discord, LinkedIn, and iMessage shows the actual
star curve, the actual star count, and the chosen theme, and looks as good as
the in-app chart.

## What the current image gets wrong (checked 2026-09-05)

Rendered `/api/og?repos=47ng/nuqs&theme=terminal` from production:

- **The curve is fake.** `makeSeries` draws a `t^1.7` power curve with a sine
  wobble, seeded by the repo name. It has no relation to the repo's history.
  The x-axis says "Start · Middle · Now" because there are no real dates.
- **The theme is only half applied.** Background and line colour come from the
  theme, but the font is Inter everywhere. Terminal should be monospace and
  8-Bit should be Press Start 2P, as they are in the app. The wordmark and
  legend are hardcoded `#fff`, so Light, Minimal, Arctic, and Sakura render
  white text on a white card.
- **Brand outweighs data.** A 56px "RepoStars" wordmark and a generic
  subtitle take the top third. The star count is a 20px parenthetical in the
  legend. On a phone-sized preview the number is unreadable.
- **Wrong repos on a slow fetch.** If GitHub takes more than 1.2s, the route
  silently renders shadcn/nuqs/tailwind sample data under someone else's
  share link.
- **Three-repo cap.** The app compares up to five; the image drops the rest.
- Only `getRepoInfo` is fetched, so exact history (now cheap and exact after
  the star history API switch) is never used.

## Design

Data is the hero. Brand is a small signature. The image should read like a
cropped screenshot of the app's chart card, but composed for a 1200×630 frame
viewed at thumbnail size.

### Layout, single repo

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ◆ RepoStars                                              ● Terminal      │  40px row, muted
│                                                                          │
│ 47ng/nuqs                                            ★ 10,807            │  64px heading / 56px accent
│ Type-safe search params state manager for React …    +312 last 90 days   │  22px muted, 1 line, ellipsis
│                                                                          │
│ 12k ┤                                                    ╭──●  10.8k     │
│     │                                            ╭───────╯               │  chart fills the rest
│  6k ┤                                   ╭────────╯                       │  area gradient below line
│     │                     ╭─────────────╯                                │  soft glow on line
│   0 ┼────────────────────╯                                               │
│     May 2020                    Aug 2023                       Today     │  real dates
│                                                                          │
│ repostars.dev                            Exact star history from GitHub  │  16px muted
└──────────────────────────────────────────────────────────────────────────┘
```

### Layout, two to five repos

Same frame. Heading becomes `47ng/nuqs vs vercel/next.js` (two repos) or
`3 repositories compared` (three or more). The description line is replaced by
a legend row of chips: colour dot, name, compact star count. Lines share one
time axis from the earliest creation date, exactly as `mergeStarHistories`
does in the app, so a young repo starts flat at zero and the comparison is
honest. End markers get a value label only when they do not overlap
(sort by final y, drop a label if it is within 28px of the previous one).

### Theme treatments

The `ChartTheme` record already carries everything needed. Rules:

| Token | Used for |
| --- | --- |
| `background` | frame background |
| `tooltipText` | heading, primary numbers (it is dark on light themes) |
| `textColor` | muted text, axis labels |
| `gridColor` | grid lines, card border |
| `lineColors[i]` | series line, area gradient, chips, end labels |
| `areaOpacity` | area gradient top opacity (0 on Minimal, so no fill) |
| `fontFamily` | when set, replaces the body font |

Special cases, matching the in-app charts:

- **8-Bit**: Press Start 2P, `shapeRendering: crispEdges`, stepped line
  (horizontal/vertical segments), 8px square markers, 4px hard border, no
  gradient, no glow. ASCII `*` instead of ★ (the font has no star glyph).
- **Terminal**: monospace, thin dotted grid, brighter line glow, `>` prefix
  on the heading, footer in the same green.
- **Light / Minimal / Arctic / Sakura**: no white overlays. Card surface is
  `${textColor}0A`; grid overlay uses `gridColor`, not `rgba(255,255,255,…)`.
- **Neon / Synthwave**: a second blurred copy of the line at 40% opacity
  under the crisp one for the glow the app shows.

### Typography

Satori needs font files; there is no system font fallback. Commit four TTFs
under `app/api/og/fonts/` and load them once per process with
`fetch(new URL("./fonts/…", import.meta.url))`:

| File | Use |
| --- | --- |
| `Montserrat-Bold.ttf` | headings (matches the site's `--font-heading`) |
| `Roboto-Regular.ttf` | body (matches `--font-sans`) |
| `JetBrainsMono-Medium.ttf` | Terminal theme |
| `PressStart2P-Regular.ttf` | 8-Bit theme |

About 900KB total, loaded lazily per theme so Terminal does not pay for the
pixel font.

## Data

- Load each repo with `getRepoData` from `lib/repo-cache.ts`, in parallel
  with `Promise.allSettled`, each wrapped in a 2500ms timeout. Up to five
  repos.
- A repo that fails or times out renders as a muted chip "owner/repo ·
  unavailable" and is left off the chart. Sample repos are never substituted.
  If every repo fails, render the branded fallback card with the requested
  names in the heading so the share still identifies what was shared.
- Resample each history onto a 160-point time grid with step semantics
  (carry last value), reusing `mergeStarHistories(repos, { pointCount: 160,
  step: true })` so the OG and the app agree on shape. Estimated histories
  keep their texture pass, and the footer says "Estimated history" for them.
- Growth line: `getGrowthStats(repos, theme, 90)` for "+N last 90 days".
- Axis: three x labels from the real grid (first, middle, last as "May 2020"
  / "Today"), three y ticks (0, mid, max) using `formatStars`.

## Route and caching

- Keep `app/api/og/route.tsx` as the entry, but split it:
  `lib/og/load-og-repos.ts` (data, unit tested with mocked fetch),
  `lib/og/og-card.tsx` (layout, pure function of data + theme),
  `lib/og/og-fonts.ts` (font loading and per-theme selection).
- Never return 500. Any thrown error renders the fallback card.
- `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`,
  same day-level freshness as the stars route. Star counts drift by a few
  per day; a 24h-old preview is fine.
- `page.tsx`: raise the repo cap to five, bump `ogVersion` to `5` so X,
  Slack, and Discord refetch, and put the theme name in the alt text. Keep
  `generateMetadata` free of GitHub calls so page rendering stays cheap; the
  image carries the numbers.
- Total budget under 4s so crawlers (X gives ~5s) do not give up:
  fonts are process-cached, data is ≤2.5s, satori + resvg is ~300ms.

## Verification

1. `scripts/render-og-matrix.mts`: renders the route handler locally for the
   matrix {dark, light, minimal, 8bit, terminal, neon, sakura} × {1 repo,
   2 repos, 5 repos, 1 unavailable repo, all unavailable} into
   `.og-preview/*.png`. Reviewed by eye before merging; this is the design
   gate, not a snapshot test.
2. Vitest: repo loading (timeout → unavailable chip, never sample data),
   resampling produces 160 points, label collision rule, route returns
   `image/png` with 200 for a normal request and for an all-failed request.
3. Manual: paste a share link into X's card validator, Slack, and Discord.
   Check that a long repo name truncates with an ellipsis and that the
   number is legible at the 500px-wide thumbnail size X uses.

## Commits

1. `lib/og/load-og-repos.ts` + tests: real histories, timeouts, resampling.
2. `lib/og/og-fonts.ts` + font files.
3. `lib/og/og-card.tsx`: single-repo layout on the dark theme.
4. Multi-repo layout, legend chips, end-label collision rule.
5. Theme treatments: light palettes, Terminal, 8-Bit, Neon glow.
6. Route wiring, fallback card, cache headers, `page.tsx` cap and `ogv=5`.
7. Render-matrix script and the fixes it surfaces.

## Out of scope

- A second image size for Twitter summary cards; `summary_large_image`
  accepts 1200×630.
- Fetching GitHub data inside `generateMetadata` for a richer description.
  Worth revisiting once the stars route has a `"use cache"` boundary.

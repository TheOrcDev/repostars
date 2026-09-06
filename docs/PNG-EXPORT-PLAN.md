# Plan: server-rendered PNG export

> Status: implemented 2026-09-07. `lib/og/render-og.tsx` backs both
> `/api/og` and `/api/export`; `OG_EXPORT=1 pnpm og:preview` renders 2x files.

Goal: the Download button produces the same high-quality image on every
device. Today it screenshots the live chart with html-to-image, so a phone
gets a 300px-wide file with fallback fonts, and until the iOS sizing fix it
also captured the broken half-height layout.

## Approach

Reuse the OG card renderer. It already draws the exact chart for up to five
repos in any theme with the real fonts, and the design is the artifact people
share. A new route renders it at 2x for download.

Verified on 2026-09-07: wrapping the existing `OgCard` in a
`transform: scale(2)` container inside a 2400×1260 `ImageResponse` produces a
crisp 2400×1260 PNG in ~435ms. Satori handles the transform, text and SVG stay
vector until rasterisation, and no card constants need to change.

## Server

### `lib/og/render-og.tsx` (new)

Extract the body of `app/api/og/route.tsx` into one function both routes
call:

```ts
interface RenderOgOptions {
  names: string[];
  themeId: string;
  scale?: 1 | 2;          // default 1
  fallback: "card" | "error";
}
async function renderOg(options): Promise<Response>
```

- Loads repos and fonts in parallel exactly as the OG route does now.
- `scale: 2` wraps the card in the transform container and doubles the
  `ImageResponse` width and height.
- `fallback: "card"` keeps today's share behaviour (brand card on failure).
  `fallback: "error"` returns `502` JSON `{ error }` when no repo loads, so a
  download never silently saves the brand card under a repo's filename.

### `app/api/og/route.tsx`

Becomes a thin wrapper: parse params, call `renderOg({ scale: 1,
fallback: "card" })`. Behaviour and cache headers unchanged.

### `app/api/export/route.tsx` (new)

- Params: `repos`, `theme`, same parsing as OG. No `scale` param exposed;
  export is always 2x so the URL space stays small for caching.
- Calls `renderOg({ scale: 2, fallback: "error" })`.
- Headers: `Content-Type: image/png`,
  `Content-Disposition: attachment; filename="repostars-<a>_<b>.png"`,
  `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`.
  The filename helper moves out of `export-bar.tsx` into `lib/og/` so client
  and server agree.
- Budget: repo loading ≤2.5s (existing timeout) + ~0.5s render. Under
  Vercel's default function timeout with room to spare.

## Client

### `components/export-bar.tsx`

- `exportPng` builds `/api/export?repos=…&theme=…`, fetches it, and on
  `response.ok` saves the blob:
  1. If `navigator.canShare?.({ files: [file] })` is true (iOS and Android
     browsers), call `navigator.share({ files })` so the phone offers "Save
     Image". Treat `AbortError` as a cancel, not a failure.
  2. Otherwise create an object URL and click a temporary `<a download>`.
- Non-ok response: read `{ error }` and toast it.
- Show the existing spinner state on the PNG button while the fetch runs;
  disable the button to prevent double downloads.
- Delete `relaxLabelClipping`, the `toPng` import, and the `chartRef` prop.
- `pnpm remove html-to-image`.

### `components/home-content.tsx` and `components/star-chart.tsx`

- Drop `chartRef` plumbing (the ref only existed for screenshots; the
  `ChartSection` forwardRef can stay or go, reviewer's call).
- Remove the `data-export-exclude` attributes; nothing screenshots the DOM
  any more.

## Parity notes

- **Companion insights** were already excluded from exports, so no parity
  work.
- **8-Bit** uses the OG card's pixel treatment (Press Start 2P, stepped
  line), which differs slightly from the in-app 8-bit chart. Acceptable; the
  card is the share artifact.
- **Estimated histories** render with the "Estimated history" footer, as on
  the share card.
- **Legend and range stats** from the interactive chart are not in the file.
  If a user selection range should export, that is a separate feature.

## Tests

- `lib/og/og-route.test.ts`: add cases for `/api/export`: returns
  `image/png` with `Content-Disposition` attachment and a 2400×1260 header
  (read IHDR bytes 16–24); returns 502 JSON when every repo fails; OG route
  still returns the brand card on failure.
- `lib/og/export-filename.test.ts`: filename from repo names, slashes
  replaced, order preserved.
- Render matrix script gains an `export` flag to write 2x files for eyeball
  review of a light theme, 8-Bit, and a five-repo comparison at 2x.

## Commits

1. Extract `renderOg` from the OG route, no behaviour change.
2. Add `/api/export` with 2x scale, attachment headers, error fallback, and
   tests.
3. Switch the Download button to the route with share-sheet support; remove
   html-to-image and the ref plumbing.
4. Render-matrix export flag and any visual fixes it surfaces.

## Out of scope

- A pixel-identical copy of the interactive chart (hover markers, range
  selection). The server card is the export.
- SVG export. The route could return Satori's SVG with one flag later.

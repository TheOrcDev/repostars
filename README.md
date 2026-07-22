# <img src="public/repostars-logo.png" width="32" height="32" alt="RepoStars" /> RepoStars

Modern, themeable GitHub star history charts. Track and compare repos with beautiful visualizations.

![RepoStars](public/og-image.png)

## Features

- **15 Themes** — Dark, Light, Neon, Minimal, 8-Bit, Sunset, Ocean, Candy, Forest, Terminal, Lava, Arctic, Copper, Synthwave, Sakura
- **Compare repos** — Up to 5 repos side-by-side on the same chart
- **Smart sampling** — Interpolated data with smart binning, fast even for repos with 200K+ stars
- **Graceful public fallback** — Shows a labelled estimate when GitHub restricts exact star timestamps
- **Shareable links** — URL params sync via nuqs — copy link with repos and theme baked in
- **Export PNG** — 2x resolution chart export
- **24h CDN cache** — Fast repeat loads, no unnecessary GitHub API calls

## Development

```bash
pnpm install
pnpm dev
```

Optionally set `GITHUB_TOKEN` in `.env.local` for higher GitHub API rate limits. GitHub only exposes exact stargazer timestamps for repositories the token owner administers or collaborates on. For other public repositories, RepoStars builds a clearly labelled estimate from public archive data and current repository metadata.

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS v4
- shadcn/ui
- Recharts
- nuqs (URL search params)
- GitHub REST API
- ClickHouse public repository snapshots and OSS Insight event archive (estimated fallback)

## License

MIT

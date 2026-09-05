# <img src="public/repostars-logo.svg" width="32" height="32" alt="RepoStars" /> RepoStars

Modern, themeable GitHub star history charts. Track and compare repos with beautiful visualizations.

![RepoStars](https://repostars.dev/api/og?repos=47ng/nuqs&theme=dark)

## Features

- **15 Themes** — Dark, Light, Neon, Minimal, 8-Bit, Sunset, Ocean, Candy, Forest, Terminal, Lava, Arctic, Copper, Synthwave, Sakura
- **Compare repos** — Up to 5 repos side-by-side on the same chart
- **Exact history** — Per-day star counts for every public repo from GitHub's star history API, fast even for repos with 200K+ stars
- **Graceful fallback** — Shows a clearly labelled estimate if GitHub's star history is unavailable
- **Shareable links** — URL params sync via nuqs — copy link with repos and theme baked in
- **Export PNG** — 2x resolution chart export
- **24h CDN cache** — Fast repeat loads, no unnecessary GitHub API calls

## Development

```bash
pnpm install
pnpm dev
```

Set `GITHUB_TOKEN` in `.env.local` for production. Star history needs no special access, but a full history costs one request per 30 weeks of repo age, and the unauthenticated limit of 60 requests per hour covers only a few repositories. Any token with public read access raises that to 5,000 per hour.

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS v4
- shadcn/ui
- Recharts
- nuqs (URL search params)
- GitHub REST API (repository metadata and the star history endpoint)

## License

MIT

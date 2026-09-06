<p align="center">
  <a href="https://repostars.dev">
    <img src="public/repostars-logo.svg" width="72" height="72" alt="RepoStars logo" />
  </a>
</p>

<h1 align="center">RepoStars</h1>

<p align="center">
  GitHub star history, beautifully charted.<br />
  Exact per-day data, 20 themes, one shareable link.
</p>

<p align="center">
  <a href="https://github.com/TheOrcDev/repostars/stargazers"><img src="https://shieldcn.dev/github/TheOrcDev/repostars/stars.svg" alt="GitHub stars" /></a>
  <a href="LICENSE"><img src="https://shieldcn.dev/github/TheOrcDev/repostars/license.svg" alt="License" /></a>
  <a href="https://repostars.dev"><img src="https://shieldcn.dev/badge/Deployed%20on-Vercel-000000.svg?logo=vercel" alt="Deployed on Vercel" /></a>
  <a href="https://nextjs.org"><img src="https://shieldcn.dev/badge/Next.js-16-000000.svg?logo=nextdotjs" alt="Next.js 16" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://shieldcn.dev/badge/TypeScript-strict-3178c6.svg?logo=typescript" alt="TypeScript" /></a>
  <a href="https://x.com/theorcdev"><img src="https://shieldcn.dev/x/follow/theorcdev.svg" alt="Follow @theorcdev on X" /></a>
</p>

<p align="center">
  <a href="https://repostars.dev/?repos=47ng/nuqs&theme=terminal">
    <img src="https://repostars.dev/api/og?repos=47ng/nuqs&theme=terminal" width="800" alt="RepoStars chart for 47ng/nuqs in the Terminal theme" />
  </a>
</p>

<p align="center">
  <a href="https://repostars.dev"><strong>Open RepoStars</strong></a> ·
  <a href="https://repostars.dev/?repos=vercel/next.js,47ng/nuqs,shadcn-ui/ui&theme=neon">Try a comparison</a> ·
  <a href="#embed-in-your-readme">Embed in your README</a>
</p>

## Why RepoStars

Most star-history tools stopped working in July 2026 when GitHub restricted access to individual stargazer timestamps. RepoStars uses GitHub's new [privacy-safe star history endpoint](https://github.blog/changelog/2026-09-04-new-api-endpoint-provides-privacy-safe-star-history-data/), which returns exact per-day aggregate counts for every public repository with no token required. No scraping, no estimates, no stargazer identities.

## Features

- **Exact history.** Per-day star counts straight from GitHub, for any public repo, at any age. Repos under about three years old render daily; older ones render exact weekly totals.
- **Compare up to five repos** on one time axis, from the earliest creation date, so a young repo starts flat at zero and the comparison is honest.
- **20 themes.** Dark, Light, Neon, Minimal, 8-Bit, Sunset, Ocean, Candy, Forest, Terminal, Lava, Arctic, Copper, Synthwave, Sakura, Noir, Espresso, Dune, Grape, and Aurora. Terminal is monospace, 8-Bit is a real pixel font with stepped lines.
- **Shareable links.** Repos and theme live in the URL. Paste a link into X, Slack, or Discord and the preview shows the actual chart, the actual star count, and the chosen theme.
- **PNG export.** Rendered on the server at 2400×1260 with the real fonts, so the file looks the same from a phone or a desktop. Phones get the share sheet with "Save Image".
- **README embed.** One markdown snippet gives you a live, themed sparkline of the last 90 days.
- **Insights on demand.** Growth over the last 90 days and star share between compared repos, one click away and kept out of exports.
- **Honest fallback.** If GitHub's history is ever unavailable, the chart is drawn as a clearly labelled estimate. The current star total is always exact.

## Embed in your README

```markdown
[![Star history](https://repostars.dev/api/embed?repo=OWNER/REPO&theme=terminal)](https://repostars.dev/?repos=OWNER/REPO&theme=terminal)
```

The image is the last 90 days at 700×420, cached for an hour. Use any theme id from the list above. The share card at `/api/og?repos=OWNER/REPO&theme=dark` works the same way for a full-history image at 1200×630.

## Image endpoints

| Endpoint | Returns |
| --- | --- |
| `/api/og?repos=a/b,c/d&theme=dark` | 1200×630 share card with the real chart. Up to five repos. |
| `/api/export?repos=a/b&theme=dark` | Same card at 2400×1260 as a PNG download. |
| `/api/embed?repo=a/b&theme=dark` | 700×420 SVG sparkline of the last 90 days. |
| `/api/stars/OWNER/REPO` | JSON: repo info plus the daily or weekly history the charts use. |

All image responses are cached at the CDN for a day, so link crawlers and READMEs cost GitHub nothing after the first render.

## Development

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

Set `GITHUB_TOKEN` in `.env.local`. Star history needs no special access, but a full history costs one request per 30 weeks of repository age, and the unauthenticated limit of 60 requests per hour covers only a few repos. Any token with public read access raises that to 5,000 per hour.

```bash
pnpm test         # vitest
pnpm check        # biome via ultracite
pnpm og:preview   # render every theme and scenario to .og-preview/ for review
```

Set `OG_EXPORT=1` before `pnpm og:preview` to render the 2x download variant instead.

## Stack

- [Next.js 16](https://nextjs.org) App Router with cache components
- [React 19](https://react.dev), [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- [visx](https://airbnb.io/visx) and [motion](https://motion.dev) for the charts
- [Satori](https://github.com/vercel/satori) via `next/og` for share cards and exports
- [nuqs](https://nuqs.dev) for URL state
- GitHub REST API: repository metadata and the star history endpoint

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and run `pnpm check` and `pnpm test` before opening a PR. Notable changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © [OrcDev](https://orcdev.com)

# Plan: adopt GitHub's star history endpoint

> Status: implemented. Both phases below shipped together in one PR on
> 2026-09-05 because the fallback chain's tests would otherwise have been
> rewritten twice. The new source lives in `lib/github-star-history.ts`.

GitHub shipped `GET /repos/{owner}/{repo}/stargazers/history` on 2026-09-04
(changelog: https://github.blog/changelog/2026-09-04-new-api-endpoint-provides-privacy-safe-star-history-data/,
docs: https://docs.github.com/rest/activity/starring?apiVersion=2026-03-10#get-repository-star-history).
It returns exact aggregate star counts per day for the whole life of any public
repository, with no stargazer identities and no admin/collaborator requirement.

That removes the reason the estimation pipeline exists. Since July 2026 the
only exact source (`/stargazers` with `star+json`) has been admin-only, so
RepoStars reconstructs curves from ClickHouse snapshots, GH Archive events,
Wayback captures, OSS Insight, and the repo events feed, then textures them.
The new endpoint makes every chart exact for every public repo.

## What the endpoint actually returns (verified 2026-09-05)

Probed live against `vercel/next.js` and `47ng/nuqs`:

| Fact | Value |
| --- | --- |
| Auth | Not required. Unauthenticated returns 200. |
| Rate limit | Standard core limit: 60/hr unauth, 5000/hr with a token. |
| Page size | `per_page` max 30 weeks, `page` max 100 (3000 weeks, ~57 years). |
| Order | Newest week first; page 1 is the most recent; pages walk back to creation. |
| Item shape | `{ week: unixSeconds, total: int, days: [sun, mon, ..., sat] }` |
| `week` | Sunday 00:00. Docs say boundaries are "not guaranteed to align with UTC". |
| Zero weeks | Present with zero counts, so the series is continuous. |
| Sum of `total` | Equals `stargazers_count` exactly for nuqs (10807 = 10807). Unstars are already netted out. |
| Pagination | `Link` header with `rel="next"` and `rel="last"` (URLs use `/repositories/{id}/...`). |
| Errors | 404 for unknown repo, 422 for validation or "endpoint has been spammed". |
| Pages for a 10-year repo | 18 (next.js), 11 for a 6-year repo (nuqs). |

The `API-Version: 2026-03-10` header was sent in every probe. Pin it.

## Target architecture

```
getRepoInfo ──► fetchGitHubStarHistory (new, primary)
                  │ ok  ──► exact daily/weekly StarDataPoint[]  estimated=false
                  │ fail ──► createSnapshotEstimate (creation→today line)  estimated=true
```

The multi-provider chain in `lib/star-history-providers.ts` is deleted in
phase 2. Until then it stays as the fallback so a bad week at GitHub does not
regress charts to a straight line.

## Phase 1: new primary source (one PR, small commits)

### Commit 1: pure transform + pager in a new module

Create `lib/github-star-history.ts`. Keep fetching and shaping separate so
the shaping is unit-testable without mocking `fetch`.

- `parseLinkLastPage(linkHeader): number | null`
- `fetchStarHistoryWeeks(owner, repo, { token, signal })`
  - GET page 1 with `per_page=30`, `Accept: application/vnd.github+json`,
    `X-GitHub-Api-Version: 2026-03-10`, `Authorization` when a token exists.
  - Read `rel="last"`; fetch pages 2..last with bounded concurrency (6).
    Fall back to `Math.ceil(weeksSince(createdAt) / 30)` only if `Link` is
    missing.
  - Any non-200 page (403/429 rate limit, 422 spammed, 5xx) throws a typed
    error. Never return a partial series; a missing page in the middle would
    silently drop months of stars.
  - Response validation: each item has `days.length === 7`, integers ≥ 0,
    `total === sum(days)`. Discard the response on violation.
- `toStarHistory(weeks, { createdAt, totalStars, today })`
  - Reverse to oldest-first, expand each week into 7 daily deltas at
    `week + d * DAY` (compute dates in UTC from the timestamp; only the
    calendar date is kept, which sidesteps the boundary caveat).
  - Cumulate into `StarDataPoint[]` with ISO dates.
  - Drop days after `today` (the current week has future zero days).
  - Resolution rule: emit daily points when `weeks * 7 <= RAW_HISTORY_MAX_POINTS`
    (about 3.3 years), otherwise one point per week (the week's own `total`, so
    still exact). Both stay under the 1200-point pass-through cap in
    `getStarHistoryResult`, so the staircase binning is never hit.
  - Leading point `{ createdAt date, 0 }` if the first week starts after
    creation. Final point is forced to `{ today, totalStars }` from repo info
    so an in-flight star or a stale CDN response cannot leave the line short
    or above the header total. If `sum(total) !== totalStars`, log once at
    debug level; the clamp already handles it.
- Tests (`lib/github-star-history.test.ts`): reverse ordering across pages,
  Sunday-first day offsets, daily vs weekly emission threshold, future-day
  trimming, `Link` parsing, partial failure throws, sum mismatch clamps,
  malformed item rejection.

### Commit 2: wire it in as the primary path

`lib/github.ts`:

- `getStarHistoryResult` becomes: `totalStars === 0 → []`; try
  `fetchGitHubStarHistory`; on success return `{ estimated: false, history }`;
  on failure fall into the existing `fetchPublicStarHistory` branch with
  `estimated: true`.
- Delete `fetchRestStargazerPage`, `MAX_GITHUB_PAGES`, the page sampler, the
  probe, `warnMissingToken`, and the `star+json` header. The stargazers
  listing endpoint is admin-only and no longer useful.
- Rate limit handling: the route already maps messages containing "rate
  limit" to 429. When the new endpoint is rate limited, prefer the estimate
  over a 429, since the estimate is what users get today. Reserve 429 for
  when `getRepoInfo` itself is limited.
- `RAW_HISTORY_MAX_POINTS` comment: now documents the daily/weekly switch.
- Keep the staircase/interpolation code for the fallback path only. It can
  go in phase 2.

`lib/github.test.ts`: the 18 existing cases mostly exercise the fallback
chain and stargazer probes. Rewrite the top of the file: new cases for "exact
history from the history endpoint", "history endpoint 429 falls back to
estimate", "history endpoint 404 with stars > 0 falls back", "zero stars
returns empty without calling the endpoint". Delete the probe/401/403
stargazer cases. Keep the provider-chain cases until phase 2 (they still pass
because that code still runs as the fallback).

### Commit 3: consumers

- `hooks/use-repos.ts`: bump `CLIENT_CACHE_VERSION` to `v8` so cached
  estimated curves in localStorage are replaced by exact ones. Same reason
  the 2026-08-02 changelog entry gives.
- `app/api/embed/route.ts`: `history.slice(-90)` assumed one point per
  history entry. Slice by date (last 90 days) so weekly-resolution histories
  show three months, not 90 weeks. The `estimated` branch and texture call
  stay for fallback output.
- `components/chart-section.tsx`: banner copy changes to explain the
  fallback, e.g. "GitHub's star history was unavailable, so this curve is
  estimated. Current star total is exact." It now only appears on failure.
- `components/charts/star-history-data.ts` and `lib/star-history-texture.ts`:
  no change. Texture only runs when `estimated` is true.
- OG route: check it reads nothing that changed (it uses `getRepoData`).

### Commit 4: docs

- `README.md` line 24: the token is now only for the 5000/hr rate limit.
  Remove the admin/collaborator sentence. Update the data-sources list.
- `.env.example`: same wording.
- `CHANGELOG.md`: "Exact star history for every public repository" entry
  dated on release, noting that estimated charts are now a rare fallback.
- `AGENTS.md`: nothing (it is the generic React guide).

Ship phase 1, watch logs for how often the fallback fires.

## Phase 2: delete the estimation pipeline (separate PR, after a week)

- Delete `lib/star-history-providers.ts` (773 lines: ClickHouse, GH Archive,
  Wayback, OSS Insight, repo events) and its tests in `lib/github.test.ts`.
- Keep a 20-line `createSnapshotEstimate` (creation → today straight line) as
  the only fallback, moved into `lib/github.ts` or a tiny module.
- Delete the staircase binning and smoothstep tail in `getStarHistoryResult`;
  the new transform already produces the final shape.
- Decide on `lib/star-history-texture.ts`: with only a two-point fallback
  left, texture still makes that line look organic. Keep it, it is
  self-contained and tested.
- Remove `GITHUB_EVENTS_*`, `CLICKHOUSE_*`, `OSS_INSIGHT_*`, `WAYBACK_*`
  constants and any README mention of those providers.

## Rate limit budget and caching

A 10-year repo costs 19 requests (1 repo info + 18 pages). Unauthenticated
that is 3 repos per hour per egress IP, which is not enough for a public
deployment. Mitigations, in order:

1. Set `GITHUB_TOKEN` in production (5000/hr, so ~260 old repos per hour).
   The token no longer needs any scope beyond public read.
2. The stars route already sends `s-maxage=86400`; keep it. Consider
   wrapping the history fetch in `"use cache"` with `cacheLife("days")`
   keyed by canonical `fullName`, keeping errors outside the cache boundary
   as `lib/repo-cache.ts` already notes.
3. Do not cache individual pages longer than the repo. Page numbering shifts
   every week because page 1 is always the newest, so page N's content is
   not stable.

## Risks and open questions

- **Week boundary timezone.** Docs say boundaries may not be UTC. Sample
  data was Sunday 00:00 UTC. Treating `week` as a calendar date in UTC is
  correct to within a day; no user-visible impact at daily resolution.
- **422 "spammed".** Unknown threshold. Treat like a rate limit: fall back,
  do not retry in the same request.
- **Very old repos.** 100 pages × 30 weeks covers repos created before
  GitHub existed, so the cap is not reachable.
- **Renamed repos.** The endpoint accepts the redirected name (the `Link`
  URLs use the numeric repo id). Use `info.fullName` for the request to
  avoid a redirect hop.
- **Private repos with a token.** Not tested. Out of scope for RepoStars.

## Definition of done for phase 1

- `pnpm test` green with new transform tests and rewritten route tests.
- `pnpm check` clean.
- Loading `vercel/next.js`, `47ng/nuqs`, and a repo created this week shows
  no estimated banner and the last point equals the header star count.
- Killing network access to `api.github.com/repos/*/stargazers/history` in
  a dev run shows the banner and a fallback curve, not an error state.

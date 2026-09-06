/**
 * Render the OG image route for a matrix of themes and repo scenarios into
 * .og-preview/*.png so the design can be reviewed by eye.
 *
 *   node --import tsx scripts/render-og-matrix.mts [theme,...] [scenario,...]
 *
 * Set OG_EXPORT=1 to render through the 2x download route instead.
 *
 * Add `--env-file=.env` before `--import` to use GITHUB_TOKEN.
 *
 * GitHub responses are memoised in-process, so the matrix costs one set of
 * requests per unique repository regardless of how many themes render.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const THEMES = process.argv[2]?.split(",") ?? [
  "dark",
  "light",
  "minimal",
  "8bit",
  "terminal",
  "neon",
  "sakura",
];

const SCENARIO_FILTER = process.argv[3]?.split(",");

const SCENARIOS: Record<string, string> = {
  "1-repo": "47ng/nuqs",
  "young-repo": "TheOrcDev/repostars",
  "2-repos": "47ng/nuqs,TheOrcDev/repostars",
  "5-repos":
    "vercel/next.js,47ng/nuqs,shadcn-ui/ui,TheOrcDev/repostars,colinhacks/zod",
  "1-unavailable": "47ng/nuqs,acme/does-not-exist-xyz",
  "all-unavailable": "acme/does-not-exist-xyz",
  none: "",
};

const OUT_DIR = join(process.cwd(), ".og-preview");
const CACHE_FILE = join(OUT_DIR, "github-cache.json");

interface CachedResponse {
  body: string;
  link: string | null;
  status: number;
}

// GitHub responses are cached on disk so re-rendering after a design tweak
// costs no requests and stays within the unauthenticated rate limit.
const diskCache: Record<string, CachedResponse> = await readFile(
  CACHE_FILE,
  "utf8"
)
  .then((raw) => JSON.parse(raw) as Record<string, CachedResponse>)
  .catch(() => ({}));
const inflight = new Map<string, Promise<CachedResponse>>();
const realFetch = globalThis.fetch;

async function cachedGitHub(input: RequestInfo | URL, init?: RequestInit) {
  const url = input instanceof Request ? input.url : input.toString();
  let pending = inflight.get(url);
  if (!pending) {
    pending = diskCache[url]
      ? Promise.resolve(diskCache[url])
      : realFetch(input, init).then(async (response) => {
          const entry: CachedResponse = {
            body: await response.text(),
            link: response.headers.get("link"),
            status: response.status,
          };
          if (response.ok) {
            diskCache[url] = entry;
          }
          return entry;
        });
    inflight.set(url, pending);
  }
  const entry = await pending;
  return new Response(entry.body, {
    headers: entry.link
      ? { "Content-Type": "application/json", Link: entry.link }
      : { "Content-Type": "application/json" },
    status: entry.status,
  });
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : input.toString();
  return url.startsWith("https://api.github.com")
    ? cachedGitHub(input, init)
    : realFetch(input, init);
}) as typeof fetch;

const EXPORT = process.env.OG_EXPORT === "1";
const { GET } = await import(
  EXPORT ? "../app/api/export/route" : "../app/api/og/route"
);

await mkdir(OUT_DIR, { recursive: true });

for (const theme of THEMES) {
  for (const [scenario, repos] of Object.entries(SCENARIOS)) {
    if (SCENARIO_FILTER && !SCENARIO_FILTER.includes(scenario)) {
      continue;
    }
    const params = new URLSearchParams({ theme });
    if (repos) {
      params.set("repos", repos);
    }
    const started = Date.now();
    const response = await GET(
      new Request(`http://localhost/api/og?${params}`) as never
    );
    const suffix = EXPORT ? "--2x" : "";
    const file = join(OUT_DIR, `${theme}--${scenario}${suffix}.png`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    console.log(
      `${theme.padEnd(9)} ${scenario.padEnd(16)} ${response.status} ${Date.now() - started}ms`
    );
  }
}

await writeFile(CACHE_FILE, JSON.stringify(diskCache));

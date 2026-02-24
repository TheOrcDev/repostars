import { Suspense } from "react";
import { type SearchParams } from "nuqs/server";
import { searchParamsCache } from "@/lib/search-params";
import { HomeContent } from "@/components/home-content";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { getRepoInfo, getStarHistory } from "@/lib/github";
import type { StarDataPoint, RepoInfo } from "@/lib/github";

export interface PreloadedRepo {
  info: RepoInfo;
  history: StarDataPoint[];
}

type PageProps = {
  searchParams: Promise<SearchParams>;
};

async function prefetchRepos(reposParam: string): Promise<PreloadedRepo[]> {
  if (!reposParam) return [];

  const repoList = reposParam
    .split(",")
    .filter(Boolean)
    .slice(0, 5);

  const results: PreloadedRepo[] = [];

  for (const fullName of repoList) {
    const [owner, repo] = fullName.split("/");
    if (!owner || !repo) continue;
    try {
      const info = await getRepoInfo(owner, repo);
      const history = await getStarHistory(owner, repo, info);
      results.push({ info, history });
    } catch {
      // Skip repos that fail
    }
  }

  return results;
}

export default async function Home({ searchParams }: PageProps) {
  const { repos: reposParam, theme } = await searchParamsCache.parse(searchParams);
  const preloadedRepos = await prefetchRepos(reposParam);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Hero />
      <Suspense
        fallback={
          <div className="flex h-[500px] items-center justify-center">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        }
      >
        <HomeContent
          initialRepos={preloadedRepos}
          initialTheme={theme}
        />
      </Suspense>
      <Footer />
    </main>
  );
}

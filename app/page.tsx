import { Suspense } from "react";
import { type SearchParams } from "nuqs/server";
import { searchParamsCache } from "@/lib/search-params";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { HomeContent } from "@/components/home-content";
import { ChartSkeleton } from "@/components/chart-skeleton";
import { getRepoInfo, getStarHistory } from "@/lib/github";
import type { StarDataPoint, RepoInfo } from "@/lib/github";

export interface PreloadedRepo {
  info: RepoInfo;
  history: StarDataPoint[];
}

type PageProps = {
  searchParams: Promise<SearchParams>;
};

async function PrefetchedContent({ reposParam, theme }: { reposParam: string; theme: string }) {
  const preloadedRepos: PreloadedRepo[] = [];

  if (reposParam) {
    const repoList = reposParam.split(",").filter(Boolean).slice(0, 5);
    for (const fullName of repoList) {
      const [owner, repo] = fullName.split("/");
      if (!owner || !repo) continue;
      try {
        const info = await getRepoInfo(owner, repo);
        const history = await getStarHistory(owner, repo, info);
        preloadedRepos.push({ info, history });
      } catch {}
    }
  }

  return <HomeContent initialRepos={preloadedRepos} initialTheme={theme} />;
}

export default async function Home({ searchParams }: PageProps) {
  const { repos: reposParam, theme } = await searchParamsCache.parse(searchParams);
  const hasRepos = Boolean(reposParam);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Hero />
      {hasRepos ? (
        <Suspense fallback={<ChartSkeleton />}>
          <PrefetchedContent reposParam={reposParam} theme={theme} />
        </Suspense>
      ) : (
        <HomeContent initialRepos={[]} initialTheme={theme} />
      )}
      <Footer />
    </main>
  );
}

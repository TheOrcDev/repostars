import { Suspense } from "react";
import { type SearchParams } from "nuqs/server";
import { searchParamsCache } from "@/lib/search-params";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { HomeContent } from "@/components/home-content";
import { ChartSkeleton } from "@/components/chart-skeleton";
import { getRepoDataCached, type RepoData } from "@/lib/repo-cache";

export interface PreloadedRepo extends RepoData {}

type PageProps = {
  searchParams: Promise<SearchParams>;
};

async function PrefetchedContent({ reposParam, theme }: { reposParam: string; theme: string }) {
  const preloadedRepos: PreloadedRepo[] = [];

  if (reposParam) {
    const repoList = reposParam.split(",").filter(Boolean).slice(0, 5);

    const loaded = await Promise.all(
      repoList.map(async (fullName) => {
        const [owner, repo] = fullName.split("/");
        if (!owner || !repo) return null;
        try {
          return await getRepoDataCached(owner, repo);
        } catch {
          return null;
        }
      })
    );

    preloadedRepos.push(...loaded.filter((item): item is PreloadedRepo => item !== null));
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

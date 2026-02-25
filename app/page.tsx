import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { HomeContent } from "@/components/home-content";
import { type SearchParams } from "nuqs/server";
import { searchParamsCache } from "@/lib/search-params";

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Home({ searchParams }: PageProps) {
  const { repos: reposParam, theme } = await searchParamsCache.parse(searchParams);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Hero />
      <HomeContent
        initialRepos={[]}
        initialTheme={theme}
        initialReposParam={reposParam}
      />
      <Footer />
    </main>
  );
}

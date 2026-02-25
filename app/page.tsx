import type { Metadata } from "next";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { HomeContent } from "@/components/home-content";
import { type SearchParams } from "nuqs/server";
import { searchParamsCache } from "@/lib/search-params";

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { repos, theme } = await searchParamsCache.parse(searchParams);
  const params = new URLSearchParams();
  if (repos) params.set("repos", repos);
  if (theme) params.set("theme", theme);

  const ogUrl = params.toString()
    ? `/api/og?${params.toString()}`
    : "/og-image.png";

  return {
    openGraph: {
      images: [{ url: ogUrl, width: 1200, height: 630, alt: "RepoStars" }],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogUrl],
    },
  };
}

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

import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HomeContent } from "@/components/home-content";
import { searchParamsCache } from "@/lib/search-params";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { repos, theme } = await searchParamsCache.parse(searchParams);
  const params = new URLSearchParams();
  if (repos) {
    params.set("repos", repos);
  }
  if (theme) {
    params.set("theme", theme);
  }

  const repoList = repos ? repos.split(",").filter(Boolean).slice(0, 3) : [];
  const repoText =
    repoList.length > 0 ? repoList.join(" · ") : "GitHub repositories";

  const ogVersion = "4";
  const ogUrl =
    repoList.length > 0
      ? `/api/og?${params.toString()}&ogv=${ogVersion}`
      : `/og-image.png?v=${ogVersion}`;

  return {
    title:
      repoList.length > 0
        ? `RepoStars — ${repoText}`
        : "RepoStars — GitHub Star History Charts",
    description:
      repoList.length > 0
        ? `Compare star history for ${repoText} on RepoStars.${theme ? ` Theme: ${theme}.` : ""}`
        : "Track, compare, and visualize GitHub star history with beautiful themeable charts.",
    openGraph: {
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: `RepoStars — ${repoText}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogUrl],
    },
  };
}

export default async function Home({ searchParams }: PageProps) {
  const { repos: reposParam, theme } =
    await searchParamsCache.parse(searchParams);

  const hasRepos = !!reposParam && reposParam.length > 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Hero compact={hasRepos} />
      <HomeContent
        initialRepos={[]}
        initialReposParam={reposParam}
        initialTheme={theme}
      />
      <Footer />
    </main>
  );
}

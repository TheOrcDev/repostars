import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HomeContent } from "@/components/home-content";
import { searchParamsCache } from "@/lib/search-params";

type PageProps = {
  searchParams: Promise<SearchParams>;
};

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

  // Keep homepage OG static for reliability. Use dynamic OG only when repos are provided.
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Hero />
      <HomeContent
        initialRepos={[]}
        initialReposParam={reposParam}
        initialTheme={theme}
      />
      <Footer />
    </main>
  );
}

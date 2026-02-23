"use client";

import { useState, useCallback } from "react";
import { StarChart } from "@/components/star-chart";
import { ThemePicker } from "@/components/theme-picker";
import { RepoSearch } from "@/components/repo-search";
import { RepoChips } from "@/components/repo-chips";
import { themes, defaultTheme } from "@/lib/themes";
import type { StarDataPoint, RepoInfo } from "@/lib/github";

interface LoadedRepo {
  info: RepoInfo;
  history: StarDataPoint[];
}

export default function Home() {
  const [themeId, setThemeId] = useState(defaultTheme);
  const [repos, setRepos] = useState<LoadedRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const theme = themes[themeId];

  const addRepo = useCallback(
    async (owner: string, repo: string) => {
      const fullName = `${owner}/${repo}`;

      // Don't add duplicates
      if (repos.some((r) => r.info.fullName.toLowerCase() === fullName.toLowerCase())) {
        setError("Repo already added");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/stars/${owner}/${repo}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to fetch repo");
          return;
        }

        setRepos((prev) => [...prev, { info: data.info, history: data.history }]);
      } catch {
        setError("Failed to fetch star data");
      } finally {
        setLoading(false);
      }
    },
    [repos]
  );

  const removeRepo = useCallback((name: string) => {
    setRepos((prev) => prev.filter((r) => r.info.fullName !== name));
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">
          ★ Star History
        </h1>
        <p className="text-lg text-[#888]">
          Track and compare GitHub star history with beautiful charts
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <RepoSearch onAdd={addRepo} loading={loading} repoCount={repos.length} />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {/* Repo chips */}
      {repos.length > 0 && (
        <div className="mb-4">
          <RepoChips
            repos={repos.map((r) => ({
              name: r.info.fullName,
              stars: r.info.stars,
            }))}
            themeId={themeId}
            onRemove={removeRepo}
          />
        </div>
      )}

      {/* Chart */}
      {repos.length > 0 ? (
        <div className="mb-6">
          <StarChart
            repos={repos.map((r) => ({
              name: r.info.fullName,
              data: r.history,
            }))}
            theme={theme}
          />
        </div>
      ) : (
        <div className="mb-6 flex h-[400px] items-center justify-center rounded-xl border border-[#222] bg-[#0a0a0a]">
          <div className="text-center text-[#555]">
            <p className="mb-2 text-5xl">★</p>
            <p className="text-lg">Add a repo to see its star history</p>
            <p className="mt-1 text-sm">
              Try{" "}
              <button
                onClick={() => addRepo("facebook", "react")}
                className="text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400"
              >
                facebook/react
              </button>
              {" or "}
              <button
                onClick={() => addRepo("vercel", "next.js")}
                className="text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400"
              >
                vercel/next.js
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Theme picker */}
      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#666]">
          Theme
        </p>
        <ThemePicker current={themeId} onChange={setThemeId} />
      </div>

      {/* Share/Export */}
      {repos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set(
                "repos",
                repos.map((r) => r.info.fullName).join(",")
              );
              url.searchParams.set("theme", themeId);
              navigator.clipboard.writeText(url.toString());
            }}
            className="rounded-lg border border-[#333] px-4 py-2 text-sm text-[#888] transition-colors hover:border-[#555] hover:text-white"
          >
            Copy Link
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 border-t border-[#222] pt-6 text-center text-sm text-[#555]">
        <p>
          Built by{" "}
          <a
            href="https://github.com/TheOrcDev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] hover:text-white"
          >
            OrcDev
          </a>
          {" · "}
          <a
            href="https://github.com/TheOrcDev/star-history"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] hover:text-white"
          >
            Source
          </a>
        </p>
      </footer>
    </main>
  );
}

"use client";

import { useRef } from "react";
import { ChartSection } from "@/components/chart-section";
import { EmptyState } from "@/components/empty-state";
import { ExportBar } from "@/components/export-bar";
import { RepoChips } from "@/components/repo-chips";
import { RepoSearch } from "@/components/repo-search";
import { ThemePicker } from "@/components/theme-picker";
import { type LoadedRepo, useRepos } from "@/hooks/use-repos";

interface HomeContentProps {
  initialRepos?: LoadedRepo[];
  initialReposParam?: string;
  initialTheme?: string;
}

export function HomeContent({
  initialRepos = [],
  initialTheme,
  initialReposParam = "",
}: HomeContentProps) {
  const {
    repos,
    loading,
    error,
    themeId,
    theme,
    setThemeId,
    addRepo,
    removeRepo,
  } = useRepos({ initialRepos, initialTheme, initialReposParam });

  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className="mb-6">
        <RepoSearch
          loading={loading}
          onAdd={addRepo}
          repoCount={repos.length}
        />
        {error && <p className="mt-2 text-destructive text-sm">{error}</p>}
      </div>

      {repos.length > 0 && (
        <div className="mb-4">
          <RepoChips
            onRemove={removeRepo}
            repos={repos.map((r) => ({
              name: r.info.fullName,
              stars: r.info.stars,
            }))}
            themeId={themeId}
          />
        </div>
      )}

      {repos.length > 0 ? (
        <ChartSection
          ref={chartRef}
          repos={repos}
          theme={theme}
          themeId={themeId}
        />
      ) : (
        <EmptyState loading={loading} onAdd={addRepo} />
      )}

      <div className="mb-8">
        <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Theme
        </p>
        <ThemePicker current={themeId} onChange={setThemeId} />
      </div>

      {repos.length > 0 && (
        <ExportBar
          chartRef={chartRef}
          repoNames={repos.map((r) => r.info.fullName)}
          theme={theme}
        />
      )}
    </>
  );
}

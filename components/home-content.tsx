"use client";

import { useRef } from "react";
import { useRepos, type LoadedRepo } from "@/hooks/use-repos";
import { RepoSearch } from "@/components/repo-search";
import { RepoChips } from "@/components/repo-chips";
import { ChartSection } from "@/components/chart-section";
import { EmptyState } from "@/components/empty-state";
import { ThemePicker } from "@/components/theme-picker";
import { ExportBar } from "@/components/export-bar";

interface HomeContentProps {
  initialRepos?: LoadedRepo[];
  initialTheme?: string;
}

export function HomeContent({ initialRepos = [], initialTheme }: HomeContentProps) {
  const {
    repos,
    loading,
    error,
    themeId,
    theme,
    setThemeId,
    addRepo,
    removeRepo,
  } = useRepos({ initialRepos, initialTheme });

  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className="mb-6">
        <RepoSearch onAdd={addRepo} loading={loading} repoCount={repos.length} />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>

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

      {repos.length > 0 ? (
        <ChartSection
          ref={chartRef}
          repos={repos}
          themeId={themeId}
          theme={theme}
        />
      ) : (
        <EmptyState onAdd={addRepo} loading={loading} />
      )}

      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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

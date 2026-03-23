"use client";

import { useRef } from "react";
import { ChartSection } from "@/components/chart-section";
import { EmptyState } from "@/components/empty-state";
import { ExportBar, HeaderShareActions } from "@/components/export-bar";
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
  const hasRepos = repos.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div>
        <RepoSearch
          loading={loading}
          onAdd={addRepo}
          repoCount={repos.length}
        />
        {error && <p className="mt-2 text-destructive text-sm">{error}</p>}
      </div>

      {/* Control bar: chips + theme */}
      {hasRepos && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <RepoChips
              onRemove={removeRepo}
              repos={repos.map((r) => ({
                name: r.info.fullName,
                stars: r.info.stars,
              }))}
              themeId={themeId}
            />
          </div>
          <div className="w-full rounded-xl border bg-muted/30 p-2 lg:w-auto lg:min-w-fit">
            <div className="flex items-center gap-2 overflow-x-auto">
              <HeaderShareActions
                chartRef={chartRef}
                repoNames={repos.map((r) => r.info.fullName)}
                theme={theme}
              />
              <ThemePicker
                className="w-[9rem] shrink-0 border-border/70 bg-background/90 sm:w-[180px]"
                current={themeId}
                onChange={setThemeId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Chart or empty state */}
      {hasRepos ? (
        <div className="overflow-hidden rounded-lg border shadow-sm">
          <ChartSection
            ref={chartRef}
            repos={repos}
            theme={theme}
            themeId={themeId}
          />
          <div className="border-t bg-muted/30 px-4 py-2">
            <ExportBar
              repoNames={repos.map((r) => r.info.fullName)}
              theme={theme}
            />
          </div>
        </div>
      ) : (
        <EmptyState loading={loading} onAdd={addRepo} />
      )}
    </div>
  );
}

"use client";

import { StarChart } from "@/components/star-chart";
import { StarChart8Bit } from "@/components/star-chart-8bit";
import type { LoadedRepo } from "@/hooks/use-repos";
import type { ChartTheme } from "@/lib/themes";

interface ChartSectionProps {
  repos: LoadedRepo[];
  theme: ChartTheme;
  themeId: string;
}

export function ChartSection({ repos, themeId, theme }: ChartSectionProps) {
  const repoData = repos.map((r) => ({
    data: r.history,
    estimated: r.estimated,
    name: r.info.fullName,
  }));
  const hasEstimatedHistory = repos.some((repo) => repo.estimated);

  return (
    <div className="mb-6">
      {hasEstimatedHistory && (
        <p className="border-b bg-muted/40 px-4 py-2 text-muted-foreground text-xs">
          GitHub&apos;s star history was unavailable, so this curve is estimated
          — current star total is exact.
        </p>
      )}
      {themeId === "8bit" ? (
        <StarChart8Bit repos={repoData} theme={theme} />
      ) : (
        <StarChart repos={repoData} theme={theme} />
      )}
    </div>
  );
}

"use client";

import { forwardRef } from "react";
import { StarChart } from "@/components/star-chart";
import { StarChart8Bit } from "@/components/star-chart-8bit";
import type { LoadedRepo } from "@/hooks/use-repos";
import type { ChartTheme } from "@/lib/themes";

interface ChartSectionProps {
  repos: LoadedRepo[];
  theme: ChartTheme;
  themeId: string;
}

export const ChartSection = forwardRef<HTMLDivElement, ChartSectionProps>(
  function ChartSection({ repos, themeId, theme }, ref) {
    const repoData = repos.map((r) => ({
      name: r.info.fullName,
      data: r.history,
    }));
    const hasEstimatedHistory = repos.some((repo) => repo.estimated);

    return (
      <div className="mb-6" ref={ref}>
        {hasEstimatedHistory && (
          <p className="border-b bg-muted/40 px-4 py-2 text-muted-foreground text-xs">
            Estimated from public star activity — current star total is exact.
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
);

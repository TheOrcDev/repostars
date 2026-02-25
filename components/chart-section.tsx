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

    return (
      <div className="mb-6">
        {themeId === "8bit" ? (
          <StarChart8Bit ref={ref} repos={repoData} theme={theme} />
        ) : (
          <StarChart ref={ref} repos={repoData} theme={theme} />
        )}
      </div>
    );
  }
);

"use client";

import { useMemo } from "react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";
import {
  formatStars,
  getGrowthStats,
  getStarShareData,
  type RepoChartData,
} from "@/components/charts/star-history-data";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import type { TooltipRow } from "@/components/charts/tooltip/tooltip-content";
import type { ChartTheme } from "@/lib/themes";

interface StarCompanionChartsProps {
  repos: RepoChartData[];
  theme: ChartTheme;
}

const GROWTH_WINDOW_DAYS = 90;

function shortRepoName(name: string) {
  return name.split("/").at(-1) ?? name;
}

export function StarCompanionCharts({
  repos,
  theme,
}: StarCompanionChartsProps) {
  const growth = useMemo(
    () => getGrowthStats(repos, theme, GROWTH_WINDOW_DAYS),
    [repos, theme]
  );
  const share = useMemo(() => getStarShareData(repos, theme), [repos, theme]);
  const growthRows = useMemo(() => {
    const row: Record<string, string | number> = { period: "Last 90 days" };
    for (const repo of growth) {
      row[repo.name] = repo.gain;
    }
    return [row];
  }, [growth]);
  const hasGrowth = growth.some((repo) => repo.gain > 0);

  if (!(hasGrowth || share.some((repo) => repo.value > 0))) {
    return null;
  }

  const growthRowsForTooltip = (point: Record<string, unknown>): TooltipRow[] =>
    growth.map((repo) => ({
      color: repo.color,
      label: repo.name,
      value: formatStars(Number(point[repo.name] ?? 0)),
    }));

  return (
    <div
      className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.8fr)]"
      style={{ borderColor: theme.gridColor }}
    >
      {hasGrowth ? (
        <section className="min-w-0">
          <div
            className="mb-2 flex items-baseline justify-between gap-3 text-xs"
            style={{ color: theme.textColor }}
          >
            <span className="font-medium" style={{ color: theme.tooltipText }}>
              Last 90 Days
            </span>
            <span className="tabular-nums opacity-80">
              +
              {formatStars(
                growth.reduce((total, repo) => total + repo.gain, 0)
              )}
            </span>
          </div>
          <BarChart
            aspectRatio="4 / 1"
            barGap={0.24}
            data={growthRows}
            margin={{ top: 18, right: 16, bottom: 28, left: 16 }}
            xDataKey="period"
          >
            <Grid horizontal stroke={theme.gridColor} />
            {growth.map((repo) => (
              <Bar
                dataKey={repo.name}
                fill={repo.color}
                key={repo.name}
                lineCap={6}
                stroke={repo.color}
              />
            ))}
            <BarXAxis />
            <ChartTooltip
              panelStyle={{
                background: theme.tooltipBg,
                border: `1px solid ${theme.tooltipBorder}`,
              }}
              rows={growthRowsForTooltip}
            />
          </BarChart>
        </section>
      ) : null}

      <section className="min-w-0">
        <div
          className="mb-2 flex items-baseline justify-between gap-3 text-xs"
          style={{ color: theme.textColor }}
        >
          <span className="font-medium" style={{ color: theme.tooltipText }}>
            Star Share
          </span>
          <span className="tabular-nums opacity-80">
            {formatStars(share.reduce((total, repo) => total + repo.value, 0))}
          </span>
        </div>
        <div className="mx-auto max-w-[220px]">
          <RingChart
            baseInnerRadius={42}
            data={share}
            ringGap={5}
            size={220}
            strokeWidth={10}
          >
            {share.map((repo, index) => (
              <Ring color={repo.color} index={index} key={repo.label} />
            ))}
            <RingCenter
              defaultLabel="Total stars"
              formatOptions={{
                maximumFractionDigits: 1,
                notation: "compact",
              }}
            >
              {({ label, value }) => (
                <div className="flex min-w-0 flex-col items-center text-center">
                  <span
                    className="font-semibold text-[15px] tabular-nums"
                    style={{ color: theme.tooltipText }}
                  >
                    {formatStars(value)}
                  </span>
                  <span
                    className="max-w-[84px] truncate text-[10px]"
                    style={{ color: theme.textColor }}
                    title={label}
                  >
                    {shortRepoName(label)}
                  </span>
                </div>
              )}
            </RingCenter>
          </RingChart>
        </div>
      </section>
    </div>
  );
}

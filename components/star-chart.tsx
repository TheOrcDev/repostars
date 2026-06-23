"use client";

import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Area } from "@/components/charts/area";
import { AreaChart } from "@/components/charts/area-chart";
import {
  useChartHover,
  useChartStable,
} from "@/components/charts/chart-context";
import { Grid } from "@/components/charts/grid";
import {
  formatFullDate,
  formatStars,
  getChartThemeVars,
  getRangeStats,
  getRepoSeriesKeys,
  mergeStarHistories,
  type RangeStats,
  type RepoChartData,
} from "@/components/charts/star-history-data";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import type { TooltipRow } from "@/components/charts/tooltip/tooltip-content";
import { XAxis } from "@/components/charts/x-axis";
import { StarCompanionCharts } from "@/components/star-companion-charts";
import type { ChartTheme } from "@/lib/themes";

interface StarChartProps {
  repos: RepoChartData[];
  theme: ChartTheme;
}

type ChartStyle = CSSProperties & Record<`--${string}`, string>;

function YAxis({ fontSize = 12 }: { fontSize?: number }) {
  const { yScale, innerHeight } = useChartStable();
  const ticks = yScale.ticks?.(5) ?? [0];

  return (
    <g>
      {ticks.map((tick) => (
        <text
          dominantBaseline="middle"
          fill="var(--chart-foreground)"
          fontSize={fontSize}
          key={tick}
          opacity={0.82}
          textAnchor="end"
          x={-12}
          y={Math.max(0, Math.min(innerHeight, yScale(tick) ?? 0))}
        >
          {formatStars(tick)}
        </text>
      ))}
    </g>
  );
}

YAxis.displayName = "YAxis";

function SelectionStatsBridge({
  onChange,
  repoNames,
  rows,
  theme,
}: {
  onChange: (stats: RangeStats | null) => void;
  repoNames: string[];
  rows: ReturnType<typeof mergeStarHistories>;
  theme: ChartTheme;
}) {
  const { selection } = useChartHover();

  useEffect(() => {
    if (!selection?.active) {
      onChange(null);
      return;
    }
    onChange(
      getRangeStats(
        rows,
        repoNames,
        theme,
        selection.startIndex,
        selection.endIndex
      )
    );
  }, [onChange, repoNames, rows, selection, theme]);

  return null;
}

function RangeStatsPanel({
  stats,
  theme,
}: {
  stats: RangeStats | null;
  theme: ChartTheme;
}) {
  if (!stats) {
    return null;
  }

  return (
    <div
      className="mt-3 grid gap-3 border-t pt-3 text-xs sm:grid-cols-[1fr_auto]"
      style={{ borderColor: theme.gridColor, color: theme.textColor }}
    >
      <div className="min-w-0">
        <div className="font-medium" style={{ color: theme.tooltipText }}>
          {formatFullDate(stats.startDate)} to {formatFullDate(stats.endDate)}
        </div>
        {stats.fastest ? (
          <div className="mt-1 truncate">
            Fastest:{" "}
            <span style={{ color: stats.fastest.color }}>
              {stats.fastest.name}
            </span>{" "}
            +{formatStars(stats.fastest.gain)}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 font-semibold tabular-nums sm:justify-end">
        <span style={{ color: theme.tooltipText }}>
          +{formatStars(stats.totalGain)}
        </span>
        <span className="font-normal opacity-75">stars</span>
      </div>
    </div>
  );
}

export const StarChart = forwardRef<HTMLDivElement, StarChartProps>(
  function StarChart({ repos, theme }, ref) {
    const rows = useMemo(() => mergeStarHistories(repos), [repos]);
    const repoNames = useMemo(() => getRepoSeriesKeys(repos), [repos]);
    const [rangeStats, setRangeStats] = useState<RangeStats | null>(null);
    const chartStyle = useMemo<ChartStyle>(
      () => ({
        ...getChartThemeVars(theme),
        background: theme.background,
        color: theme.textColor,
        fontFamily: theme.fontFamily,
      }),
      [theme]
    );

    if (repos.length === 0 || rows.length === 0) {
      return (
        <div
          className="flex h-[400px] items-center justify-center rounded-lg"
          ref={ref}
          style={chartStyle}
        >
          No star data available
        </div>
      );
    }

    const tooltipRows = (point: Record<string, unknown>): TooltipRow[] =>
      repoNames.map((name, index) => ({
        color: theme.lineColors[index % theme.lineColors.length],
        label: name,
        value: formatStars(Number(point[name] ?? 0)),
      }));

    return (
      <div className="rounded-lg p-4" ref={ref} style={chartStyle}>
        {repoNames.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-4 text-[13px]">
            {repoNames.map((name, index) => (
              <div
                className="flex min-w-0 max-w-[260px] items-center gap-1.5"
                key={name}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background:
                      theme.lineColors[index % theme.lineColors.length],
                  }}
                />
                <span className="truncate" title={name}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <AreaChart
          aspectRatio="2 / 1"
          data={rows}
          margin={{ top: 24, right: 24, bottom: 36, left: 58 }}
          style={{ minHeight: 360 }}
        >
          <Grid
            horizontal
            stroke={theme.gridColor}
            vertical={repoNames.length <= 2}
          />
          <YAxis />
          {repoNames.map((name, index) => (
            <Area
              dataKey={name}
              fadeEdges
              fill={theme.lineColors[index % theme.lineColors.length]}
              fillOpacity={theme.areaOpacity * 1.8}
              gradientToOpacity={0}
              key={name}
              markers={{
                radius: 3,
                strokeWidth: 2,
              }}
              showMarkers={repoNames.length === 2 && rows.length <= 80}
              stroke={theme.lineColors[index % theme.lineColors.length]}
              strokeWidth={2.4}
            />
          ))}
          <SelectionStatsBridge
            onChange={setRangeStats}
            repoNames={repoNames}
            rows={rows}
            theme={theme}
          />
          <XAxis numTicks={5} />
          <ChartTooltip
            panelStyle={{
              background: theme.tooltipBg,
              border: `1px solid ${theme.tooltipBorder}`,
            }}
            rows={tooltipRows}
          />
        </AreaChart>

        <RangeStatsPanel stats={rangeStats} theme={theme} />
        {repos.length > 1 ? (
          <StarCompanionCharts repos={repos} theme={theme} />
        ) : null}
      </div>
    );
  }
);

"use client";

import { curveLinear } from "@visx/curve";
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
  getRepoLegendItems,
  getRepoSeriesKeys,
  isSnapshotHistory,
  mergeStarHistories,
  type RangeSeries,
  type RangeStats,
  type RepoChartData,
} from "@/components/charts/star-history-data";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import type { TooltipRow } from "@/components/charts/tooltip/tooltip-content";
import { XAxis } from "@/components/charts/x-axis";
import { StarCompanionCharts } from "@/components/star-companion-charts";
import type { ChartTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";

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

function ObservedSnapshotMarkers({
  repos,
  theme,
}: {
  repos: RepoChartData[];
  theme: ChartTheme;
}) {
  const { data, xAccessor, xScale, yScale } = useChartStable();

  return (
    <g>
      {repos.map((repo, index) => {
        if (!repo.estimated) {
          return null;
        }
        const color = theme.lineColors[index % theme.lineColors.length];
        const points = data.flatMap((point) => {
          const value = point[repo.name];
          if (typeof value !== "number") {
            return [];
          }
          const date = xAccessor(point);
          return [{ date, value }];
        });
        const markers = isSnapshotHistory(repo)
          ? points
          : [points[0], points.at(-1)].filter(
              (point): point is (typeof points)[number] => point !== undefined
            );
        return markers.map(({ date, value }) => (
          <circle
            cx={xScale(date) ?? 0}
            cy={yScale(value) ?? 0}
            fill={theme.background}
            key={`${repo.name}-${date.toISOString()}`}
            r={4}
            stroke={color}
            strokeWidth={2}
          />
        ));
      })}
    </g>
  );
}

ObservedSnapshotMarkers.displayName = "ChartMarkers";

function SelectionStatsBridge({
  onChange,
  rows,
  series,
}: {
  onChange: (stats: RangeStats | null) => void;
  rows: ReturnType<typeof mergeStarHistories>;
  series: RangeSeries[];
}) {
  const { selection } = useChartHover();

  useEffect(() => {
    if (!selection?.active) {
      onChange(null);
      return;
    }
    onChange(
      getRangeStats(rows, series, selection.startIndex, selection.endIndex)
    );
  }, [onChange, rows, selection, series]);

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
    const exactRepoSeries = useMemo(
      () =>
        repos.flatMap((repo, index) =>
          repo.estimated
            ? []
            : [
                {
                  color: theme.lineColors[index % theme.lineColors.length],
                  name: repo.name,
                },
              ]
        ),
      [repos, theme]
    );
    const legendItems = useMemo(
      () => getRepoLegendItems(repos, theme),
      [repos, theme]
    );
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
      repos.map((repo, index) => ({
        color: theme.lineColors[index % theme.lineColors.length],
        label: repo.name,
        value:
          typeof point[repo.name] === "number"
            ? formatStars(Number(point[repo.name]))
            : "No snapshot",
      }));

    return (
      <div className="rounded-lg p-4" ref={ref} style={chartStyle}>
        {legendItems.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-4 text-[13px]">
            {legendItems.map((item) => (
              <div
                className={cn(
                  "flex min-w-0 items-center gap-1.5",
                  // A single repo gets the full row; capping widths only keeps
                  // side-by-side legends from crowding each other out.
                  legendItems.length > 1 && "max-w-[260px]"
                )}
                key={item.name}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: item.color }}
                />
                <span className="truncate" data-legend-label title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums opacity-75">
                  ★ {formatStars(item.stars)}
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
          {repos.map((repo, index) => {
            const color = theme.lineColors[index % theme.lineColors.length];
            return (
              <Area
                curve={repo.estimated ? curveLinear : undefined}
                dataKey={repo.name}
                fadeEdges={!repo.estimated}
                fill={color}
                fillOpacity={repo.estimated ? 0 : theme.areaOpacity * 1.8}
                gradientToOpacity={0}
                key={repo.name}
                markers={{
                  fill: repo.estimated ? theme.background : color,
                  radius: repo.estimated ? 4 : 3,
                  stroke: color,
                  strokeWidth: 2,
                }}
                preserveDataPoints={repo.estimated && isSnapshotHistory(repo)}
                showHighlight={!repo.estimated}
                showMarkers={
                  !repo.estimated && repoNames.length === 2 && rows.length <= 80
                }
                stroke={color}
                strokeDasharray={repo.estimated ? "3 7" : undefined}
                strokeWidth={repo.estimated ? 2 : 2.4}
              />
            );
          })}
          <ObservedSnapshotMarkers repos={repos} theme={theme} />
          {exactRepoSeries.length > 0 ? (
            <SelectionStatsBridge
              onChange={setRangeStats}
              rows={rows}
              series={exactRepoSeries}
            />
          ) : null}
          <XAxis numTicks={5} />
          <ChartTooltip
            panelStyle={{
              background: theme.tooltipBg,
              border: `1px solid ${theme.tooltipBorder}`,
            }}
            rows={tooltipRows}
          />
        </AreaChart>

        {exactRepoSeries.length > 0 ? (
          <RangeStatsPanel stats={rangeStats} theme={theme} />
        ) : null}
        {repos.length > 1 ? (
          <StarCompanionCharts repos={repos} theme={theme} />
        ) : null}
      </div>
    );
  }
);

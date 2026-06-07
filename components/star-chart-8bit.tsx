"use client";

import { curveStepAfter } from "@visx/curve";
import { type CSSProperties, forwardRef, useMemo } from "react";
import { Area } from "@/components/charts/area";
import { AreaChart } from "@/components/charts/area-chart";
import { useChartStable } from "@/components/charts/chart-context";
import { Grid } from "@/components/charts/grid";
import {
  formatChartDate,
  formatFullDate,
  formatStars,
  getChartThemeVars,
  getRepoSeriesKeys,
  mergeStarHistories,
  type RepoChartData,
} from "@/components/charts/star-history-data";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import type { TooltipRow } from "@/components/charts/tooltip/tooltip-content";
import { XAxis } from "@/components/charts/x-axis";
import { BitCard } from "@/components/ui/bit-card";
import type { ChartTheme } from "@/lib/themes";

interface StarChart8BitProps {
  repos: RepoChartData[];
  theme: ChartTheme;
}

type ChartStyle = CSSProperties & Record<`--${string}`, string>;

function YAxis() {
  const { yScale, innerHeight } = useChartStable();
  const ticks = yScale.ticks?.(4) ?? [0];

  return (
    <g>
      {ticks.map((tick) => (
        <text
          dominantBaseline="middle"
          fill="var(--chart-foreground)"
          fontFamily="'Press Start 2P', monospace"
          fontSize={7}
          key={tick}
          opacity={0.9}
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

export const StarChart8Bit = forwardRef<HTMLDivElement, StarChart8BitProps>(
  function StarChart8Bit({ repos, theme }, ref) {
    const rows = useMemo(
      () => mergeStarHistories(repos, { step: true }),
      [repos]
    );
    const repoNames = useMemo(() => getRepoSeriesKeys(repos), [repos]);
    const chartStyle = useMemo<ChartStyle>(
      () => ({
        ...getChartThemeVars(theme),
        background: theme.background,
        color: theme.textColor,
        fontFamily: "'Press Start 2P', monospace",
        imageRendering: "pixelated",
      }),
      [theme]
    );

    if (repos.length === 0 || rows.length === 0) {
      return (
        <div ref={ref} style={chartStyle}>
          <BitCard
            className="flex h-[400px] items-center justify-center"
            style={{
              background: theme.background,
              color: theme.textColor,
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 10,
            }}
          >
            NO DATA FOUND
          </BitCard>
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
      <div ref={ref} style={chartStyle}>
        <BitCard
          className="relative overflow-hidden p-4"
          style={{
            background: theme.background,
            color: theme.textColor,
            fontFamily: "'Press Start 2P', monospace",
          }}
        >
          <div className="mb-3 flex flex-wrap gap-4 text-[8px]">
            {repoNames.map((name, index) => (
              <div
                className="flex min-w-0 max-w-[220px] items-center gap-1.5"
                key={name}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0"
                  style={{
                    background:
                      theme.lineColors[index % theme.lineColors.length],
                    border: `2px solid ${theme.background}`,
                    outline: `1px solid ${
                      theme.lineColors[index % theme.lineColors.length]
                    }`,
                  }}
                />
                <span className="truncate" title={name}>
                  {name}
                </span>
              </div>
            ))}
          </div>

          <AreaChart
            aspectRatio="2 / 1"
            data={rows}
            margin={{ top: 24, right: 24, bottom: 36, left: 58 }}
            style={{ minHeight: 360 }}
          >
            <Grid
              horizontal
              stroke={theme.gridColor}
              strokeDasharray="4,4"
              strokeWidth={2}
              vertical={false}
            />
            <YAxis />
            {repoNames.map((name, index) => (
              <Area
                curve={curveStepAfter}
                dataKey={name}
                fadeEdges={false}
                fill={theme.lineColors[index % theme.lineColors.length]}
                fillOpacity={0.24}
                gradientToOpacity={0.03}
                key={name}
                markers={{
                  radius: 3.5,
                  strokeWidth: 2,
                }}
                showMarkers={repoNames.length <= 2 && rows.length <= 120}
                stroke={theme.lineColors[index % theme.lineColors.length]}
                strokeWidth={3}
              />
            ))}
            <XAxis numTicks={4} />
            <ChartTooltip
              panelStyle={{
                background: theme.tooltipBg,
                border: `4px solid ${theme.tooltipBorder}`,
                borderRadius: 0,
                boxShadow: `0 0 0 2px ${theme.background}`,
                color: theme.tooltipText,
              }}
              rows={(point) => [
                {
                  color: theme.tooltipBorder,
                  label: formatChartDate(point.date as Date),
                  value: formatFullDate(point.date as Date),
                },
                ...tooltipRows(point),
              ]}
              showDatePill={false}
            />
          </AreaChart>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                ${theme.background}33 2px,
                ${theme.background}33 4px
              )`,
              opacity: 0.28,
            }}
          />
        </BitCard>
      </div>
    );
  }
);

"use client";

import { curveLinear, curveStepAfter } from "@visx/curve";
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
  getRepoLegendItems,
  isSnapshotHistory,
  mergeStarHistories,
  type RepoChartData,
} from "@/components/charts/star-history-data";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import type { TooltipRow } from "@/components/charts/tooltip/tooltip-content";
import { BitCard } from "@/components/ui/bit-card";
import type { ChartTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";

interface StarChart8BitProps {
  repos: RepoChartData[];
  theme: ChartTheme;
}

type ChartStyle = CSSProperties & Record<`--${string}`, string>;

const BIT_AXIS_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

function formatBitAxisDate(date: Date) {
  return BIT_AXIS_DATE_FORMATTER.format(date).replace(" ", " '");
}

function YAxis() {
  const { yScale, innerHeight } = useChartStable();
  const ticks = yScale.ticks?.(3) ?? [0];

  return (
    <g>
      {ticks.map((tick) => (
        <text
          dominantBaseline="middle"
          fill="var(--chart-foreground)"
          fontFamily="'Press Start 2P', monospace"
          fontSize={7}
          key={tick}
          opacity={0.78}
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

function PixelXAxis({ numTicks = 4 }: { numTicks?: number }) {
  const { xScale, innerHeight } = useChartStable();
  const [startDate, endDate] = xScale.domain();

  if (!(startDate && endDate)) {
    return null;
  }

  const startMs = startDate.getTime();
  const spanMs = endDate.getTime() - startMs;
  const tickCount = Math.max(2, numTicks);
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const progress = index / (tickCount - 1);
    const date = new Date(startMs + spanMs * progress);
    return {
      date,
      x: xScale(date) ?? 0,
    };
  });

  return (
    <g>
      {ticks.map(({ date, x }) => (
        <g key={date.getTime()} transform={`translate(${x},${innerHeight})`}>
          <line
            stroke="var(--chart-foreground)"
            strokeWidth={2}
            x1={0}
            x2={0}
            y1={0}
            y2={6}
          />
          <text
            dominantBaseline="hanging"
            fill="var(--chart-foreground)"
            fontFamily="'Press Start 2P', monospace"
            fontSize={8}
            opacity={0.9}
            textAnchor="middle"
            y={12}
          >
            {formatBitAxisDate(date)}
          </text>
        </g>
      ))}
    </g>
  );
}

PixelXAxis.displayName = "XAxis";

function PixelSnapshotMarkers({
  repos,
  theme,
}: {
  repos: RepoChartData[];
  theme: ChartTheme;
}) {
  const { data, xAccessor, xScale, yScale } = useChartStable();

  return (
    <g shapeRendering="crispEdges">
      {repos.map((repo, index) => {
        const name = repo.name;
        const color = theme.lineColors[index % theme.lineColors.length];
        const points = data.flatMap((point) => {
          const value = point[name];
          if (typeof value !== "number") {
            return [];
          }
          const x = xScale(xAccessor(point)) ?? 0;
          const y = yScale(value) ?? 0;
          return [{ key: xAccessor(point).toISOString(), x, y }];
        });
        const last = points.at(-1);
        let markers = points;
        if (!isSnapshotHistory(repo) && points.length > 1) {
          markers = [points[0], points.at(-1)].filter(
            (point): point is (typeof points)[number] => point !== undefined
          );
        }

        return (
          <g key={name}>
            {markers.map((point) => {
              if (!point) {
                return null;
              }
              const isLast = point === last;
              const size = isLast ? 10 : 8;
              return (
                <rect
                  fill={isLast ? color : theme.background}
                  height={size}
                  key={`${name}-${point.key}`}
                  stroke={color}
                  strokeWidth={2}
                  width={size}
                  x={point.x - size / 2}
                  y={point.y - size / 2}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

PixelSnapshotMarkers.displayName = "ChartMarkers";

export const StarChart8Bit = forwardRef<HTMLDivElement, StarChart8BitProps>(
  function StarChart8Bit({ repos, theme }, ref) {
    const rows = useMemo(() => mergeStarHistories(repos), [repos]);
    const legendItems = useMemo(
      () => getRepoLegendItems(repos, theme),
      [repos, theme]
    );
    const chartStyle = useMemo<ChartStyle>(
      () => ({
        ...getChartThemeVars(theme),
        background: theme.background,
        color: theme.textColor,
        fontFamily: "'Press Start 2P', monospace",
        imageRendering: "pixelated",
        shapeRendering: "crispEdges",
        "--bit-border": theme.lineColors[0],
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
      repos.map((repo, index) => ({
        color: theme.lineColors[index % theme.lineColors.length],
        label: repo.name,
        value:
          typeof point[repo.name] === "number"
            ? formatStars(Number(point[repo.name]))
            : "NO SNAPSHOT",
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
            {legendItems.map((item) => (
              <div
                className={cn(
                  "flex min-w-0 items-center gap-1.5",
                  // A single repo gets the full row; capping widths only keeps
                  // side-by-side legends from crowding each other out.
                  legendItems.length > 1 && "max-w-[220px]"
                )}
                key={item.name}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0"
                  style={{
                    background: item.color,
                    border: `2px solid ${theme.background}`,
                    outline: `1px solid ${item.color}`,
                  }}
                />
                <span className="truncate" data-legend-label title={item.name}>
                  {item.name}
                </span>
                {/* Press Start 2P has no ★ glyph, so the ASCII star keeps the
                    count inside the pixel font instead of a fallback face. */}
                <span className="shrink-0 whitespace-nowrap opacity-75">
                  * {formatStars(item.stars)}
                </span>
              </div>
            ))}
          </div>

          <AreaChart
            aspectRatio="2 / 1"
            data={rows}
            margin={{ top: 24, right: 24, bottom: 36, left: 58 }}
            style={{ minHeight: "clamp(260px, 62vw, 360px)" }}
          >
            <Grid
              fadeHorizontal={false}
              fadeVertical={false}
              horizontal
              numTicksColumns={4}
              numTicksRows={4}
              stroke={theme.gridColor}
              strokeDasharray="2,6"
              strokeOpacity={0.72}
              strokeWidth={1.5}
              vertical
            />
            <YAxis />
            {repos.map((repo, index) => (
              <Area
                curve={repo.estimated ? curveLinear : curveStepAfter}
                dataKey={repo.name}
                fadeEdges={false}
                fill={theme.lineColors[index % theme.lineColors.length]}
                fillOpacity={repo.estimated ? 0 : 0.34}
                gradientToOpacity={0.07}
                key={repo.name}
                preserveDataPoints={repo.estimated && isSnapshotHistory(repo)}
                showHighlight={!repo.estimated}
                showMarkers={false}
                stroke={theme.lineColors[index % theme.lineColors.length]}
                strokeDasharray={repo.estimated ? "4 8" : undefined}
                strokeLinecap="butt"
                strokeWidth={repo.estimated ? 4 : 5}
              />
            ))}
            <PixelSnapshotMarkers repos={repos} theme={theme} />
            <PixelXAxis numTicks={4} />
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
              opacity: 0.16,
            }}
          />
        </BitCard>
      </div>
    );
  }
);

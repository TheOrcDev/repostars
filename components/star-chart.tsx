"use client";

import { forwardRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StarDataPoint } from "@/lib/github";
import type { ChartTheme } from "@/lib/themes";

interface RepoData {
  data: StarDataPoint[];
  name: string;
}

interface StarChartProps {
  repos: RepoData[];
  theme: ChartTheme;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatStars(n: number) {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toString();
}

// Interpolate a star count for a given date within a repo's data
function interpolateAt(data: StarDataPoint[], dateMs: number): number {
  if (data.length === 0) {
    return 0;
  }
  const firstMs = new Date(data[0].date).getTime();
  const lastPoint = data.at(-1);
  if (!lastPoint) {
    return data[0].stars;
  }
  const lastMs = new Date(lastPoint.date).getTime();
  if (dateMs <= firstMs) {
    return dateMs === firstMs ? data[0].stars : 0;
  }
  if (dateMs >= lastMs) {
    return lastPoint.stars;
  }

  // Binary search for surrounding points
  let lo = 0,
    hi = data.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (new Date(data[mid].date).getTime() <= dateMs) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const loMs = new Date(data[lo].date).getTime();
  const hiMs = new Date(data[hi].date).getTime();
  if (hiMs === loMs) {
    return data[lo].stars;
  }
  const t = (dateMs - loMs) / (hiMs - loMs);
  return Math.round(data[lo].stars + t * (data[hi].stars - data[lo].stars));
}

// Merge multiple repos into a single timeline with interpolation
function mergeData(repos: RepoData[]) {
  // Build a unified timeline: use ~200 evenly spaced points across the full range
  let globalMin = Number.POSITIVE_INFINITY,
    globalMax = Number.NEGATIVE_INFINITY;
  for (const repo of repos) {
    for (const point of repo.data) {
      const ms = new Date(point.date).getTime();
      if (ms < globalMin) {
        globalMin = ms;
      }
      if (ms > globalMax) {
        globalMax = ms;
      }
    }
  }

  const pointCount = 200;
  const step = (globalMax - globalMin) / (pointCount - 1);

  return Array.from({ length: pointCount }, (_, i) => {
    const ms = globalMin + step * i;
    const date = new Date(ms).toISOString().split("T")[0];
    const entry: Record<string, string | number> = { date };
    for (const repo of repos) {
      entry[repo.name] = interpolateAt(repo.data, ms);
    }
    return entry;
  });
}

export const StarChart = forwardRef<HTMLDivElement, StarChartProps>(
  function StarChart({ repos, theme }, ref) {
    if (repos.length === 0 || repos.every((r) => r.data.length === 0)) {
      return (
        <div
          className="flex h-[400px] items-center justify-center rounded-xl border"
          style={{
            background: theme.background,
            borderColor: theme.gridColor,
            color: theme.textColor,
          }}
        >
          No star data available
        </div>
      );
    }

    const merged = mergeData(repos);
    const repoNames = repos.map((r) => r.name);

    return (
      <div
        className="rounded-xl border p-4"
        ref={ref}
        style={{
          background: theme.background,
          borderColor: theme.gridColor,
          fontFamily: theme.fontFamily,
        }}
      >
        {/* Legend */}
        {repoNames.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 12,
              fontSize: 13,
              color: theme.textColor,
              flexWrap: "wrap",
            }}
          >
            {repoNames.map((name, i) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 0,
                  maxWidth: 260,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: theme.lineColors[i % theme.lineColors.length],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                  title={name}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        )}

        <ResponsiveContainer height={400} width="100%">
          <AreaChart
            data={merged}
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          >
            <defs>
              {repoNames.map((name, i) => (
                <linearGradient
                  id={`gradient-${i}`}
                  key={name}
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={theme.lineColors[i % theme.lineColors.length]}
                    stopOpacity={theme.areaOpacity * 2}
                  />
                  <stop
                    offset="100%"
                    stopColor={theme.lineColors[i % theme.lineColors.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              stroke={theme.gridColor}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              minTickGap={60}
              stroke={theme.axisColor}
              tick={{ fill: theme.textColor, fontSize: 12 }}
              tickFormatter={formatDate}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              stroke={theme.axisColor}
              tick={{ fill: theme.textColor, fontSize: 12 }}
              tickFormatter={formatStars}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: theme.tooltipBg,
                border: `1px solid ${theme.tooltipBorder}`,
                borderRadius: "8px",
                color: theme.tooltipText,
                fontSize: 13,
              }}
              formatter={(value, name) => [
                formatStars(value as number),
                name as string,
              ]}
              labelFormatter={(label) =>
                new Date(label).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              }
            />
            {repoNames.map((name, i) => (
              <Area
                activeDot={{
                  r: 4,
                  fill: theme.lineColors[i % theme.lineColors.length],
                  stroke: theme.background,
                  strokeWidth: 2,
                }}
                dataKey={name}
                dot={false}
                fill={`url(#gradient-${i})`}
                key={name}
                stroke={theme.lineColors[i % theme.lineColors.length]}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
);

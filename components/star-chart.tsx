"use client";

import { forwardRef } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { type ChartTheme } from "@/lib/themes";
import { type StarDataPoint } from "@/lib/github";

interface RepoData {
  name: string;
  data: StarDataPoint[];
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
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

// Merge multiple repos into a single timeline
function mergeData(repos: RepoData[]) {
  if (repos.length === 1) {
    return repos[0].data.map((d) => ({
      date: d.date,
      [repos[0].name]: d.stars,
    }));
  }

  // Collect all unique dates
  const allDates = new Set<string>();
  for (const repo of repos) {
    for (const point of repo.data) {
      allDates.add(point.date);
    }
  }

  const sortedDates = Array.from(allDates).sort();

  return sortedDates.map((date) => {
    const entry: Record<string, string | number> = { date };
    for (const repo of repos) {
      // Find the closest data point at or before this date
      let closest = 0;
      for (const point of repo.data) {
        if (point.date <= date) closest = point.stars;
      }
      entry[repo.name] = closest;
    }
    return entry;
  });
}

export const StarChart = forwardRef<HTMLDivElement, StarChartProps>(function StarChart({ repos, theme }, ref) {
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
      ref={ref}
      className="rounded-xl border p-4"
      style={{
        background: theme.background,
        borderColor: theme.gridColor,
        fontFamily: theme.fontFamily,
      }}
    >
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={merged} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            {repoNames.map((name, i) => (
              <linearGradient
                key={name}
                id={`gradient-${i}`}
                x1="0"
                y1="0"
                x2="0"
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
            strokeDasharray="3 3"
            stroke={theme.gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke={theme.axisColor}
            tick={{ fill: theme.textColor, fontSize: 12 }}
            tickFormatter={formatDate}
            tickLine={false}
            minTickGap={60}
          />
          <YAxis
            stroke={theme.axisColor}
            tick={{ fill: theme.textColor, fontSize: 12 }}
            tickFormatter={formatStars}
            tickLine={false}
            axisLine={false}
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
            labelFormatter={(label) =>
              new Date(label).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            }
            formatter={(value, name) => [
              formatStars(value as number),
              name as string,
            ]}
          />
          {repoNames.map((name, i) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stroke={theme.lineColors[i % theme.lineColors.length]}
              strokeWidth={2}
              fill={`url(#gradient-${i})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: theme.lineColors[i % theme.lineColors.length],
                stroke: theme.background,
                strokeWidth: 2,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

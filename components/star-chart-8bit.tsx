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
import { BitCard } from "@/components/ui/bit-card";
import type { StarDataPoint } from "@/lib/github";
import type { ChartTheme } from "@/lib/themes";

interface RepoData {
  data: StarDataPoint[];
  name: string;
}

interface StarChart8BitProps {
  repos: RepoData[];
  theme: ChartTheme;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatStars(n: number) {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toString();
}

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
  return data[lo].stars;
}

function mergeData(repos: RepoData[]) {
  if (repos.length === 1) {
    return repos[0].data.map((d) => ({
      date: d.date,
      [repos[0].name]: d.stars,
    }));
  }
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

/* Pixel-art tooltip */
function PixelTooltip({
  active,
  payload,
  label,
  theme,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  theme: ChartTheme;
}) {
  if (!(active && payload?.length)) {
    return null;
  }
  const dateStr = new Date(label as string).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div
      style={{
        background: theme.tooltipBg,
        color: theme.tooltipText,
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 8,
        lineHeight: 1.8,
        padding: 0,
        imageRendering: "pixelated",
      }}
    >
      {/* Outer pixel border */}
      <div
        style={{
          border: `4px solid ${theme.tooltipBorder}`,
          padding: "8px 10px",
          position: "relative",
        }}
      >
        {/* Inner pixel edge */}
        <div
          style={{
            position: "absolute",
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            border: `2px solid ${theme.background}`,
            pointerEvents: "none",
          }}
        />
        <div style={{ marginBottom: 6, opacity: 0.7 }}>{dateStr}</div>
        {payload.map((entry) => (
          <div
            key={entry.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: entry.color,
                imageRendering: "pixelated",
              }}
            />
            <span>
              {entry.name}: {formatStars(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const StarChart8Bit = forwardRef<HTMLDivElement, StarChart8BitProps>(
  function StarChart8Bit({ repos, theme }, ref) {
    if (repos.length === 0 || repos.every((r) => r.data.length === 0)) {
      return (
        <div ref={ref}>
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

    const merged = mergeData(repos);
    const repoNames = repos.map((r) => r.name);

    return (
      <div ref={ref}>
        <BitCard
          className="p-4"
          style={{
            background: theme.background,
            fontFamily: "'Press Start 2P', monospace",
            imageRendering: "auto",
            position: "relative",
          }}
        >
          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 12,
              fontSize: 8,
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
                  maxWidth: 220,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    background: theme.lineColors[i % theme.lineColors.length],
                    border: `2px solid ${theme.background}`,
                    outline: `1px solid ${theme.lineColors[i % theme.lineColors.length]}`,
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

          <ResponsiveContainer height={400} width="100%">
            <AreaChart
              data={merged}
              margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
            >
              <defs>
                {repoNames.map((name, i) => (
                  <linearGradient
                    id={`8bit-grad-${i}`}
                    key={name}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={theme.lineColors[i % theme.lineColors.length]}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={theme.lineColors[i % theme.lineColors.length]}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                ))}
                {/* Pixel grid pattern */}
                <pattern
                  height="8"
                  id="pixel-grid"
                  patternUnits="userSpaceOnUse"
                  width="8"
                >
                  <rect fill="none" height="8" width="8" />
                  <rect
                    fill={theme.gridColor}
                    height="1"
                    opacity="0.3"
                    width="1"
                    x="0"
                    y="0"
                  />
                </pattern>
              </defs>
              <CartesianGrid
                stroke={theme.gridColor}
                strokeDasharray="4 4"
                strokeWidth={2}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                minTickGap={80}
                stroke={theme.axisColor}
                strokeWidth={2}
                tick={{
                  fill: theme.textColor,
                  fontSize: 7,
                  fontFamily: "'Press Start 2P', monospace",
                }}
                tickFormatter={formatDate}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                stroke={theme.axisColor}
                strokeWidth={2}
                tick={{
                  fill: theme.textColor,
                  fontSize: 7,
                  fontFamily: "'Press Start 2P', monospace",
                }}
                tickFormatter={formatStars}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<PixelTooltip theme={theme} />} />
              {repoNames.map((name, i) => (
                <Area
                  activeDot={{
                    r: 5,
                    fill: theme.lineColors[i % theme.lineColors.length],
                    stroke: theme.background,
                    strokeWidth: 3,
                    style: {
                      filter: `drop-shadow(0 0 4px ${theme.lineColors[i % theme.lineColors.length]})`,
                    },
                  }}
                  dataKey={name}
                  dot={false}
                  fill={`url(#8bit-grad-${i})`}
                  key={name}
                  stroke={theme.lineColors[i % theme.lineColors.length]}
                  strokeWidth={3}
                  type="stepAfter"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>

          {/* Scanline overlay for extra retro feel */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            ${theme.background}22 2px,
            ${theme.background}22 4px
          )`,
              pointerEvents: "none",
              opacity: 0.3,
            }}
          />
        </BitCard>
      </div>
    );
  }
);

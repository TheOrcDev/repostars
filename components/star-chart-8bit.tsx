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

interface StarChart8BitProps {
  repos: RepoData[];
  theme: ChartTheme;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatStars(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function mergeData(repos: RepoData[]) {
  if (repos.length === 1) {
    return repos[0].data.map((d) => ({
      date: d.date,
      [repos[0].name]: d.stars,
    }));
  }
  const allDates = new Set<string>();
  for (const repo of repos) {
    for (const point of repo.data) allDates.add(point.date);
  }
  const sortedDates = Array.from(allDates).sort();
  return sortedDates.map((date) => {
    const entry: Record<string, string | number> = { date };
    for (const repo of repos) {
      let closest = 0;
      for (const point of repo.data) {
        if (point.date <= date) closest = point.stars;
      }
      entry[repo.name] = closest;
    }
    return entry;
  });
}

/* Pixel-art tooltip */
function PixelTooltip({ active, payload, label, theme }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  theme: ChartTheme;
}) {
  if (!active || !payload?.length) return null;
  const dateStr = new Date(label as string).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
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
      <div style={{
        border: `4px solid ${theme.tooltipBorder}`,
        padding: "8px 10px",
        position: "relative",
      }}>
        {/* Inner pixel edge */}
        <div style={{
          position: "absolute",
          top: -4, left: -4, right: -4, bottom: -4,
          border: `2px solid ${theme.background}`,
          pointerEvents: "none",
        }} />
        <div style={{ marginBottom: 6, opacity: 0.7 }}>{dateStr}</div>
        {payload.map((entry) => (
          <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{
              display: "inline-block",
              width: 8, height: 8,
              background: entry.color,
              imageRendering: "pixelated",
            }} />
            <span>{entry.name}: {formatStars(entry.value)}</span>
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
        <div
          ref={ref}
          className="flex h-[400px] items-center justify-center"
          style={{
            background: theme.background,
            color: theme.textColor,
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 10,
            border: `4px solid ${theme.lineColors[0]}`,
            boxShadow: `
              4px 4px 0 0 ${theme.lineColors[0]}33,
              inset 0 0 0 2px ${theme.background}
            `,
          }}
        >
          NO DATA FOUND
        </div>
      );
    }

    const merged = mergeData(repos);
    const repoNames = repos.map((r) => r.name);

    return (
      <div
        ref={ref}
        className="p-4"
        style={{
          background: theme.background,
          fontFamily: "'Press Start 2P', monospace",
          border: `4px solid ${theme.lineColors[0]}`,
          boxShadow: `
            8px 8px 0 0 ${theme.lineColors[0]}44,
            inset 0 0 0 2px ${theme.background}
          `,
          imageRendering: "auto",
          position: "relative",
        }}
      >
        {/* Pixel corner accents */}
        <div style={{
          position: "absolute", top: -4, left: -4,
          width: 8, height: 8,
          background: theme.lineColors[0],
        }} />
        <div style={{
          position: "absolute", top: -4, right: -4,
          width: 8, height: 8,
          background: theme.lineColors[0],
        }} />
        <div style={{
          position: "absolute", bottom: -4, left: -4,
          width: 8, height: 8,
          background: theme.lineColors[0],
        }} />
        <div style={{
          position: "absolute", bottom: -4, right: -4,
          width: 8, height: 8,
          background: theme.lineColors[0],
        }} />

        {/* Legend */}
        <div style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
          fontSize: 8,
          color: theme.textColor,
        }}>
          {repoNames.map((name, i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                display: "inline-block",
                width: 10, height: 10,
                background: theme.lineColors[i % theme.lineColors.length],
                border: `2px solid ${theme.background}`,
                outline: `1px solid ${theme.lineColors[i % theme.lineColors.length]}`,
              }} />
              <span>{name}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={merged} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <defs>
              {repoNames.map((name, i) => (
                <linearGradient key={name} id={`8bit-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.lineColors[i % theme.lineColors.length]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={theme.lineColors[i % theme.lineColors.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
              {/* Pixel grid pattern */}
              <pattern id="pixel-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="none" />
                <rect width="1" height="1" x="0" y="0" fill={theme.gridColor} opacity="0.3" />
              </pattern>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={theme.gridColor}
              vertical={false}
              strokeWidth={2}
            />
            <XAxis
              dataKey="date"
              stroke={theme.axisColor}
              tick={{ fill: theme.textColor, fontSize: 7, fontFamily: "'Press Start 2P', monospace" }}
              tickFormatter={formatDate}
              tickLine={false}
              minTickGap={80}
              strokeWidth={2}
            />
            <YAxis
              stroke={theme.axisColor}
              tick={{ fill: theme.textColor, fontSize: 7, fontFamily: "'Press Start 2P', monospace" }}
              tickFormatter={formatStars}
              tickLine={false}
              axisLine={false}
              width={55}
              strokeWidth={2}
            />
            <Tooltip
              content={<PixelTooltip theme={theme} />}
            />
            {repoNames.map((name, i) => (
              <Area
                key={name}
                type="stepAfter"
                dataKey={name}
                stroke={theme.lineColors[i % theme.lineColors.length]}
                strokeWidth={3}
                fill={`url(#8bit-grad-${i})`}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: theme.lineColors[i % theme.lineColors.length],
                  stroke: theme.background,
                  strokeWidth: 3,
                  style: { filter: `drop-shadow(0 0 4px ${theme.lineColors[i % theme.lineColors.length]})` },
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>

        {/* Scanline overlay for extra retro feel */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            ${theme.background}22 2px,
            ${theme.background}22 4px
          )`,
          pointerEvents: "none",
          opacity: 0.3,
        }} />
      </div>
    );
  }
);

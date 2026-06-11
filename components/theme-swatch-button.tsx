"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { type ChartTheme, defaultTheme } from "@/lib/themes";

const DEMO_REPOS = "facebook/react";

interface ThemeSwatchButtonProps {
  theme: ChartTheme;
}

// Three preset "growth" curves used to fake a star-history preview per theme.
const previewCurves = [
  "0,50 18,46 34,40 52,30 70,20 88,11 100,6",
  "0,52 18,50 34,46 52,40 70,33 88,26 100,20",
  "0,54 18,53 34,51 52,47 70,43 88,38 100,33",
];

export function ThemeSwatchButton({ theme }: ThemeSwatchButtonProps) {
  const [{ repos }, setParams] = useQueryStates(
    {
      repos: parseAsString.withDefault(""),
      theme: parseAsString
        .withDefault(defaultTheme)
        .withOptions({ history: "replace" }),
    },
    { history: "replace" }
  );

  const colors = theme.lineColors;

  const handleClick = () => {
    setParams(
      repos ? { theme: theme.id } : { theme: theme.id, repos: DEMO_REPOS }
    ).catch(() => undefined);
    document.getElementById("compare")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <button
      className="group flex w-full flex-col gap-2.5 rounded-xl border bg-card p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={handleClick}
      type="button"
    >
      <div
        className="overflow-hidden rounded-lg border"
        style={{ borderColor: theme.gridColor || theme.axisColor }}
      >
        <svg
          aria-hidden="true"
          className="block h-auto w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 56"
        >
          <rect fill={theme.background} height="56" width="100" />
          {previewCurves.map((points, index) => (
            <polyline
              fill="none"
              key={points}
              points={points}
              stroke={colors[index % colors.length]}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5 pb-0.5">
        <span className="font-medium text-sm">{theme.name}</span>
        <span className="flex items-center gap-1">
          {colors.slice(0, 3).map((color) => (
            <span
              className="size-2 rounded-full ring-1 ring-foreground/10"
              key={`${theme.id}-${color}`}
              style={{ background: color }}
            />
          ))}
        </span>
      </div>
    </button>
  );
}

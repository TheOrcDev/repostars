"use client";

import { themes, type ChartTheme } from "@/lib/themes";

interface ThemePickerProps {
  current: string;
  onChange: (themeId: string) => void;
}

export function ThemePicker({ current, onChange }: ThemePickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(themes).map((theme: ChartTheme) => (
        <button
          key={theme.id}
          onClick={() => onChange(theme.id)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all ${
            current === theme.id
              ? "border-blue-500 bg-blue-500/10 text-white"
              : "border-[#333] text-[#888] hover:border-[#555] hover:text-white"
          }`}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: theme.lineColors[0] }}
          />
          {theme.name}
        </button>
      ))}
    </div>
  );
}

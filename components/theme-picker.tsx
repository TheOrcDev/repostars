"use client";

import { Button } from "@/components/ui/button";
import { type ChartTheme, themes } from "@/lib/themes";

interface ThemePickerProps {
  current: string;
  onChange: (themeId: string) => void;
}

export function ThemePicker({ current, onChange }: ThemePickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(themes).map((theme: ChartTheme) => (
        <Button
          className="gap-2"
          key={theme.id}
          onClick={() => onChange(theme.id)}
          size="sm"
          variant={current === theme.id ? "default" : "outline"}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: theme.lineColors[0] }}
          />
          {theme.name}
        </Button>
      ))}
    </div>
  );
}

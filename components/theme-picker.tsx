"use client";

import { themes, type ChartTheme } from "@/lib/themes";
import { Button } from "@/components/ui/button";

interface ThemePickerProps {
  current: string;
  onChange: (themeId: string) => void;
}

export function ThemePicker({ current, onChange }: ThemePickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(themes).map((theme: ChartTheme) => (
        <Button
          key={theme.id}
          onClick={() => onChange(theme.id)}
          variant={current === theme.id ? "default" : "outline"}
          size="sm"
          className="gap-2"
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

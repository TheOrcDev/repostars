"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ChartTheme, themes } from "@/lib/themes";

interface ThemePickerProps {
  current: string;
  onChange: (themeId: string) => void;
}

export function ThemePicker({ current, onChange }: ThemePickerProps) {
  return (
    <Select onValueChange={onChange} value={current}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        {Object.values(themes).map((theme: ChartTheme) => (
          <SelectItem key={theme.id} value={theme.id}>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: theme.lineColors[0] }}
              />
              {theme.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ChartTheme, themes } from "@/lib/themes";
import { cn } from "@/lib/utils";

interface ThemePickerProps {
  className?: string;
  current: string;
  onChange: (themeId: string) => void;
}

export function ThemePicker({
  className,
  current,
  onChange,
}: ThemePickerProps) {
  return (
    <Select onValueChange={onChange} value={current}>
      <SelectTrigger className={cn("w-full sm:w-[180px]", className)}>
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

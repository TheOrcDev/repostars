"use client";

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
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        Theme
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5 lg:grid-cols-10 min-[480px]:grid-cols-4">
        {Object.values(themes).map((theme: ChartTheme) => {
          const isSelected = theme.id === current;

          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 font-medium text-xs transition-all sm:gap-2 sm:px-2.5 sm:text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isSelected
                  ? "border-foreground/30 bg-foreground/5 shadow-sm"
                  : "border-border/70 bg-background/90 hover:border-foreground/20 hover:bg-muted/50"
              )}
              key={theme.id}
              onClick={() => onChange(theme.id)}
              title={theme.name}
              type="button"
            >
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-full ring-1 ring-foreground/10"
                style={{ background: theme.lineColors[0] }}
              />
              <span className="truncate">{theme.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

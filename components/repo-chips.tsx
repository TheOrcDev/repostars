"use client";

import { Badge } from "@/components/ui/badge";
import { themes } from "@/lib/themes";

interface RepoChip {
  name: string;
  stars: number;
}

interface RepoChipsProps {
  repos: RepoChip[];
  themeId: string;
  onRemove: (name: string) => void;
}

function formatStars(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function RepoChips({ repos, themeId, onRemove }: RepoChipsProps) {
  const theme = themes[themeId];

  if (repos.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {repos.map((repo, i) => (
        <Badge
          key={repo.name}
          variant="outline"
          className="gap-2 py-1.5 pl-2.5 pr-2 text-sm font-normal"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: theme.lineColors[i % theme.lineColors.length],
            }}
          />
          <span>{repo.name}</span>
          <span className="text-muted-foreground">★ {formatStars(repo.stars)}</span>
          <button
            onClick={() => onRemove(repo.name)}
            className="ml-0.5 text-muted-foreground transition-colors hover:text-destructive"
          >
            ×
          </button>
        </Badge>
      ))}
    </div>
  );
}

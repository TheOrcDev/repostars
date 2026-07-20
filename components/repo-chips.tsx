"use client";

import { Badge } from "@/components/ui/badge";
import { themes } from "@/lib/themes";

interface RepoChip {
  name: string;
  stars: number;
}

interface RepoChipsProps {
  onRemove: (name: string) => void;
  repos: RepoChip[];
  themeId: string;
}

function formatStars(n: number) {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toString();
}

export function RepoChips({ repos, themeId, onRemove }: RepoChipsProps) {
  const theme = themes[themeId];

  if (repos.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {repos.map((repo, i) => (
        <Badge
          className="h-auto max-w-full shrink gap-2 py-1 pr-1 pl-2.5 font-normal text-sm"
          key={repo.name}
          variant="outline"
        >
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{
              background: theme.lineColors[i % theme.lineColors.length],
            }}
          />
          <span className="min-w-0 truncate">{repo.name}</span>
          <span className="shrink-0 text-muted-foreground">
            ★ {formatStars(repo.stars)}
          </span>
          <button
            aria-label={`Remove ${repo.name}`}
            className="ml-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onRemove(repo.name)}
            type="button"
          >
            ×
          </button>
        </Badge>
      ))}
    </div>
  );
}

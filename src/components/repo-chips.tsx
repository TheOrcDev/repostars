"use client";

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
        <div
          key={repo.name}
          className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: theme.lineColors[i % theme.lineColors.length] + "66" }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: theme.lineColors[i % theme.lineColors.length],
            }}
          />
          <span className="text-white">{repo.name}</span>
          <span className="text-[#666]">★ {formatStars(repo.stars)}</span>
          <button
            onClick={() => onRemove(repo.name)}
            className="ml-1 text-[#555] transition-colors hover:text-red-400"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

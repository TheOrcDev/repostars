import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  loading?: boolean;
  onAdd: (owner: string, repo: string) => void;
}

const popularRepos = [
  { owner: "facebook", repo: "react", label: "facebook/react" },
  { owner: "vercel", repo: "next.js", label: "vercel/next.js" },
  { owner: "shadcn-ui", repo: "ui", label: "shadcn-ui/ui" },
  {
    owner: "tailwindlabs",
    repo: "tailwindcss",
    label: "tailwindlabs/tailwindcss",
  },
  { owner: "denoland", repo: "deno", label: "denoland/deno" },
];

export function EmptyState({ onAdd, loading }: EmptyStateProps) {
  if (loading) {
    return (
      <div className="flex h-[450px] items-center justify-center rounded-xl border border-dashed">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          <p className="text-sm">Fetching star history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[450px] flex-col items-center justify-center gap-8 rounded-xl border border-dashed text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="font-semibold text-lg">Add a repo to get started</p>
        <p className="max-w-sm text-muted-foreground text-sm">
          Search for any GitHub repository above, or try one of these popular
          ones
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {popularRepos.map((r) => (
          <Button
            className="text-xs"
            key={r.label}
            onClick={() => onAdd(r.owner, r.repo)}
            size="sm"
            variant="outline"
          >
            {r.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

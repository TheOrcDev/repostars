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
      <div className="flex h-[400px] items-center justify-center rounded-lg border">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          <p className="text-sm">Fetching star history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[400px] flex-col items-center justify-center gap-6 rounded-lg border border-dashed text-center">
      <div>
        <p className="mb-1 font-medium text-lg">No repos yet</p>
        <p className="text-muted-foreground text-sm">
          Search above or try a popular one
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {popularRepos.map((r) => (
          <Button
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

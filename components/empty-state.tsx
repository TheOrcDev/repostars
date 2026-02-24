import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  onAdd: (owner: string, repo: string) => void;
  loading?: boolean;
}

export function EmptyState({ onAdd, loading }: EmptyStateProps) {
  return (
    <Card className="mb-6">
      <CardContent className="flex h-[400px] items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            <p className="text-sm">Fetching star history...</p>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <p className="mb-2 text-5xl">★</p>
            <p className="text-lg">Add a repo to see its star history</p>
            <p className="mt-2 text-sm">
              Try{" "}
              <button
                onClick={() => onAdd("shadcn-ui", "ui")}
                className="text-primary underline decoration-primary/30 hover:decoration-primary"
              >
                shadcn-ui/ui
              </button>
              {" or "}
              <button
                onClick={() => onAdd("47ng", "nuqs")}
                className="text-primary underline decoration-primary/30 hover:decoration-primary"
              >
                47ng/nuqs
              </button>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

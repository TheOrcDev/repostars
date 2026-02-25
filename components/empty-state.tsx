import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
            <p className="mt-2 text-sm">Try one:</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAdd("shadcn-ui", "ui")}
              >
                shadcn-ui/ui
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAdd("47ng", "nuqs")}
              >
                47ng/nuqs
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

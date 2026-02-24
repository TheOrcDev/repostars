import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  onAdd: (owner: string, repo: string) => void;
}

export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <Card className="mb-6">
      <CardContent className="flex h-[400px] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="mb-2 text-5xl">★</p>
          <p className="text-lg">Add a repo to see its star history</p>
          <p className="mt-2 text-sm">
            Try{" "}
            <button
              onClick={() => onAdd("facebook", "react")}
              className="text-primary underline decoration-primary/30 hover:decoration-primary"
            >
              facebook/react
            </button>
            {" or "}
            <button
              onClick={() => onAdd("vercel", "next.js")}
              className="text-primary underline decoration-primary/30 hover:decoration-primary"
            >
              vercel/next.js
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

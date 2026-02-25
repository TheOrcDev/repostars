import { Card, CardContent } from "@/components/ui/card";

export function ChartSkeleton() {
  return (
    <>
      {/* Search bar skeleton */}
      <div className="mb-6">
        <div className="h-11 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Chips skeleton */}
      <div className="mb-4 flex gap-2">
        <div className="h-8 w-36 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Chart skeleton */}
      <Card className="mb-6">
        <CardContent className="flex h-[440px] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            <p className="text-sm">Loading star history...</p>
          </div>
        </CardContent>
      </Card>

      {/* Theme picker skeleton */}
      <div className="mb-8">
        <div className="mb-2 h-3 w-12 animate-pulse rounded bg-muted" />
        <div className="flex flex-wrap gap-2">
          {["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => (
            <div
              className="h-8 w-20 animate-pulse rounded-md bg-muted"
              key={id}
            />
          ))}
        </div>
      </div>
    </>
  );
}

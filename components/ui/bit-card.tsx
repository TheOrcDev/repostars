import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BitCardProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
}

export function BitCard({ className, ...props }: BitCardProps) {
  return (
    <div className={cn("relative border-y-6 border-foreground/70 !p-0", className)}>
      <Card {...props} className={cn("w-full rounded-none border-0", className)} />
      <div
        className="pointer-events-none absolute inset-0 -mx-1.5 border-x-6 border-foreground/70"
        aria-hidden="true"
      />
    </div>
  );
}

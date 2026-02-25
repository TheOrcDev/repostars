import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BitCardProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
}

export function BitCard({ className, ...props }: BitCardProps) {
  return (
    <div
      className={cn("!p-0 relative border-foreground/70 border-y-6", className)}
    >
      <Card
        {...props}
        className={cn("w-full rounded-none border-0", className)}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -mx-1.5 border-foreground/70 border-x-6"
      />
    </div>
  );
}

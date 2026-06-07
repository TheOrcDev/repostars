import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BitCardProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
}

export function BitCard({ className, style, ...props }: BitCardProps) {
  const frameStyle = {
    ...style,
    borderColor: "var(--bit-border, currentColor)",
  };

  return (
    <div
      className={cn("!p-0 relative border-foreground/70 border-y-6", className)}
      style={frameStyle}
    >
      <Card
        {...props}
        className={cn("w-full rounded-none border-0", className)}
        style={style}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -mx-1.5 border-foreground/70 border-x-6"
        style={{ borderColor: "var(--bit-border, currentColor)" }}
      />
    </div>
  );
}

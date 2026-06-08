import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  align?: "left" | "center";
  className?: string;
  description?: string;
  eyebrow?: string;
  title: string;
}

export function SectionHeading({
  align = "center",
  className,
  description,
  eyebrow,
  title,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        centered ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow && (
        <span className="inline-flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
          {eyebrow}
        </span>
      )}
      <h2 className="text-balance font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "text-pretty text-muted-foreground leading-relaxed sm:text-lg",
            centered && "max-w-2xl"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

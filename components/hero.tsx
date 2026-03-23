interface HeroProps {
  compact?: boolean;
}

export function Hero({ compact }: HeroProps) {
  if (compact) {
    return null;
  }

  return (
    <div className="mb-10 text-center">
      <h1 className="mb-3 font-bold text-4xl tracking-tight sm:text-5xl">
        Compare GitHub Star History
      </h1>
      <p className="mx-auto max-w-md text-muted-foreground leading-relaxed">
        Track, compare, and visualize star growth with beautiful themeable
        charts. Add up to 5 repos.
      </p>
    </div>
  );
}

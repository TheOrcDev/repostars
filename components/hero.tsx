interface HeroProps {
  compact?: boolean;
}

export function Hero({ compact }: HeroProps) {
  if (compact) {
    return null;
  }

  return (
    <div className="mb-8 text-center">
      <h1 className="mb-2 font-bold text-3xl tracking-tight sm:text-4xl">
        Compare GitHub Star History
      </h1>
      <p className="text-muted-foreground text-sm">
        Track, compare, and visualize star growth with beautiful charts
      </p>
    </div>
  );
}

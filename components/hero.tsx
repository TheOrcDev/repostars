interface HeroProps {
  compact?: boolean;
}

export function Hero({ compact }: HeroProps) {
  if (compact) {
    return (
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-2 sm:px-6 sm:pt-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
            Compare GitHub star history
          </h1>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pt-14 pb-6 sm:px-6 sm:pt-20 sm:pb-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <h1 className="text-balance font-heading font-semibold text-4xl tracking-tight sm:text-5xl md:text-6xl md:leading-[1.05]">
          GitHub star history, beautifully charted
        </h1>
      </div>
    </section>
  );
}

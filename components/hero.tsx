import { SideRays } from "@/components/side-rays";

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
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 bg-muted/40 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
        <SideRays origin="top-right" rayColor1="#EAB308" rayColor2="#8B5CF6" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-b from-transparent to-background sm:h-32"
      />
      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-14 pb-6 sm:px-6 sm:pt-20 sm:pb-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="text-balance font-heading font-semibold text-4xl tracking-tight sm:text-5xl md:text-6xl md:leading-[1.05]">
            GitHub star history, beautifully charted
          </h1>
        </div>
      </div>
    </section>
  );
}

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GitHubIcon } from "@/components/icons";
import { SideRays } from "@/components/side-rays";
import { Button } from "@/components/ui/button";
import { themeIds } from "@/lib/themes";

const REPO_URL = "https://github.com/TheOrcDev/repostars";

interface HeroProps {
  compact?: boolean;
}

export function Hero({ compact }: HeroProps) {
  const highlights = [
    `${themeIds.length} themes`,
    "PNG export",
    "Shareable links",
    "README embed",
  ];

  if (compact) {
    return (
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-2 sm:px-6 sm:pt-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
            Star history
          </span>
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
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-36 bg-gradient-to-b from-transparent to-background sm:h-44"
      />
      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="inline-flex items-center rounded-full border bg-card px-3 py-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.16em] shadow-sm">
            Free &amp; open-source — no sign-up
          </span>

          <h1 className="mt-6 text-balance font-heading font-semibold text-4xl tracking-tight sm:text-5xl md:text-6xl md:leading-[1.05]">
            GitHub star history, beautifully charted
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-muted-foreground leading-relaxed sm:text-lg">
            Track and compare star growth for up to five repositories. Pick from{" "}
            {themeIds.length} themes, export a crisp PNG, and embed it straight
            in your README.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild className="gap-2" size="lg">
              <Link href="#compare">
                Start comparing
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild className="gap-2" size="lg" variant="outline">
              <Link href={REPO_URL} rel="noopener noreferrer" target="_blank">
                <GitHubIcon className="size-4" />
                Star on GitHub
              </Link>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
            {highlights.map((item, index) => (
              <li className="flex items-center gap-2" key={item}>
                {index > 0 && (
                  <span aria-hidden="true" className="text-border">
                    •
                  </span>
                )}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

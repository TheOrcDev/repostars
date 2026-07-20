"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="mb-3 font-medium text-destructive text-xs uppercase tracking-[0.2em]">
        Something went wrong
      </p>
      <h1 className="mb-3 font-bold text-4xl text-foreground tracking-tight md:text-5xl">
        RepoStars couldn’t load
      </h1>
      <p className="mb-8 max-w-xl text-muted-foreground text-sm md:text-base">
        Try loading this view again. If the problem continues, return to the
        homepage and start a new comparison.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go to homepage</Link>
        </Button>
      </div>
    </main>
  );
}

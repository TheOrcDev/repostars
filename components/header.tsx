import Link from "next/link";
import { Suspense } from "react";
import { GitHubStarsButton } from "@/components/github-stars-button";
import { Logo } from "@/components/logo";
import { ModeToggle } from "./mode-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link className="flex items-center gap-2.5" href="/">
          <Logo className="size-7 text-foreground" />
          <span className="font-heading font-semibold text-base tracking-tight">
            RepoStars
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Suspense
            fallback={
              <span
                aria-hidden="true"
                className="h-8 w-16 animate-pulse rounded-lg bg-muted"
              />
            }
          >
            <GitHubStarsButton />
          </Suspense>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}

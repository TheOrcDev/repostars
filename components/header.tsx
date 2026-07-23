import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { GitHubStarsButton } from "@/components/github-stars-button";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "./mode-toggle";

const navLinks = [
  { href: "#compare", label: "Compare" },
  { href: "#themes", label: "Themes" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link className="flex items-center gap-2.5" href="/">
          <Image
            alt="RepoStars"
            className="rounded-md ring-1 ring-foreground/10"
            height={28}
            src="/repostars-logo.png"
            width={28}
          />
          <span className="font-heading font-semibold text-base tracking-tight">
            RepoStars
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 sm:gap-1"
        >
          {navLinks.map((link) => (
            <Button asChild key={link.href} size="sm" variant="ghost">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

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

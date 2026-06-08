import Image from "next/image";
import Link from "next/link";
import { GitHubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "./mode-toggle";

const REPO_URL = "https://github.com/TheOrcDev/repostars";

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

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Button asChild key={link.href} size="sm" variant="ghost">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Button
            asChild
            className="hidden gap-2 sm:inline-flex"
            variant="outline"
          >
            <Link href={REPO_URL} rel="noopener noreferrer" target="_blank">
              <GitHubIcon className="size-4" />
              <span>Star</span>
            </Link>
          </Button>
          <Button asChild className="sm:hidden" size="icon" variant="ghost">
            <Link
              aria-label="RepoStars on GitHub"
              href={REPO_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <GitHubIcon className="size-5" />
            </Link>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}

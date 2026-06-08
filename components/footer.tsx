import Link from "next/link";

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-8 text-muted-foreground text-sm sm:flex-row sm:px-6">
        <p>© {year} RepoStars</p>
        <p>
          Built by{" "}
          <Link
            className="text-foreground/70 underline underline-offset-4 transition-colors hover:text-foreground"
            href="https://orcdev.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            OrcDev
          </Link>
          {" with 🪓"}
        </p>
      </div>
    </footer>
  );
}

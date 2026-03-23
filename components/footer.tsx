import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t py-8">
      <div className="flex flex-col items-center gap-3 text-muted-foreground text-sm">
        <div className="flex items-center gap-4">
          <Link
            className="transition-colors hover:text-foreground"
            href="https://github.com/TheOrcDev/repostars"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </Link>
          <span className="text-border">·</span>
          <Link
            className="transition-colors hover:text-foreground"
            href="https://orcdev.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            OrcDev
          </Link>
          <span className="text-border">·</span>
          <Link
            className="transition-colors hover:text-foreground"
            href="https://x.com/theorcdev"
            rel="noopener noreferrer"
            target="_blank"
          >
            @theorcdev
          </Link>
        </div>
        <p className="text-muted-foreground/60 text-xs">
          Built with Next.js, Recharts, and shadcn/ui
        </p>
      </div>
    </footer>
  );
}

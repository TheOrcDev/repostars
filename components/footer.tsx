import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t pt-6 text-center text-muted-foreground text-sm">
      <p>
        Built by{" "}
        <Link
          className="text-foreground/70 underline hover:text-foreground"
          href="https://orcdev.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          OrcDev
        </Link>
        {" with 🪓"}
      </p>
    </footer>
  );
}

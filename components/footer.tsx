import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t pt-6 text-center text-sm text-muted-foreground">
      <p>
        Built by{" "}
        <Link
          href="https://orcdev.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/70 hover:text-foreground"
        >
          OrcDev
        </Link>
        {" with 🪓"}
      </p>
    </footer>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-[0.2em]">
        404
      </p>
      <h1 className="mb-3 font-bold text-4xl text-foreground tracking-tight md:text-5xl">
        Page not found
      </h1>
      <p className="mb-8 max-w-xl text-muted-foreground text-sm md:text-base">
        This page doesn’t exist or has been moved. Let’s get you back to
        charting stars.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">Go to homepage</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/?repos=shadcn-ui/ui,47ng/nuqs&theme=dark">
            Try a demo
          </Link>
        </Button>
      </div>
    </main>
  );
}

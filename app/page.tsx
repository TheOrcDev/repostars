import { Suspense } from "react";
import { HomeContent } from "@/components/home-content";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Hero />
      <Suspense
        fallback={
          <div className="flex h-[500px] items-center justify-center">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        }
      >
        <HomeContent />
      </Suspense>
      <Footer />
    </main>
  );
}

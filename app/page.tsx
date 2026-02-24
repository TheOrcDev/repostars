import { Suspense } from "react";
import { HomeContent } from "@/components/home-content";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

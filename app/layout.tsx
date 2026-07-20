import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Montserrat, PT_Mono, Roboto } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Header } from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const display = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const sans = Roboto({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const mono = PT_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RepoStars — GitHub Star History Charts",
    template: "%s | RepoStars",
  },
  description:
    "Track, compare, and visualize GitHub star history with beautiful themeable charts. Compare up to 5 repos side-by-side, export as PNG, and share with a link. 10 themes including 8-Bit, Neon, Terminal, and more.",
  metadataBase: new URL("https://repostars.dev"),
  keywords: [
    "github stars",
    "star history",
    "github star chart",
    "repo stars",
    "github analytics",
    "star history chart",
    "github star tracker",
    "open source analytics",
    "github star comparison",
    "repo comparison",
  ],
  authors: [{ name: "OrcDev", url: "https://orcdev.com" }],
  creator: "OrcDev",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://repostars.dev",
    siteName: "RepoStars",
    title: "RepoStars — GitHub Star History Charts",
    description:
      "Track, compare, and visualize GitHub star history with beautiful themeable charts. Compare up to 5 repos, export as PNG, share with a link.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RepoStars — GitHub Star History Charts with Themes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RepoStars — GitHub Star History Charts",
    description:
      "Track, compare, and visualize GitHub star history with beautiful themeable charts. 10 themes, PNG export, shareable links.",
    images: ["/og-image.png"],
    creator: "@theorcdev",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: "https://repostars.dev",
  },
};

function RouteLoadingFallback() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div
        className="flex flex-col items-center gap-3 text-muted-foreground"
        role="status"
      >
        <span
          aria-hidden="true"
          className="inline-block size-8 animate-spin rounded-full border-2 border-current/30 border-t-current"
        />
        <p className="text-sm">Loading RepoStars…</p>
      </div>
    </main>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      className={cn(
        "font-sans",
        sans.variable,
        display.variable,
        mono.variable
      )}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com"
          rel="preconnect"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>
          <TooltipProvider>
            <Header />
            <Suspense fallback={<RouteLoadingFallback />}>
              <NuqsAdapter>{children}</NuqsAdapter>
            </Suspense>
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Header } from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen font-sans antialiased`}
      >
        <Suspense>
          <NuqsAdapter>
            <ThemeProvider>
              <TooltipProvider>
                <Header />
                {children}
              </TooltipProvider>
            </ThemeProvider>
          </NuqsAdapter>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}

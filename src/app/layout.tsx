import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Star History — GitHub Star Charts with Themes",
  description:
    "Track and compare GitHub star history with beautiful, themeable charts. Export as SVG/PNG, embed anywhere.",
  metadataBase: new URL("https://star-history.dev"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

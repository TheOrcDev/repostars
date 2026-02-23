import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

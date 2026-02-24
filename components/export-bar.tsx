"use client";

import { useCallback, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import type { ChartTheme } from "@/lib/themes";

interface ExportBarProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  repoNames: string[];
  theme: ChartTheme;
}

export function ExportBar({ chartRef, repoNames, theme }: ExportBarProps) {
  const [copied, setCopied] = useState(false);

  const exportPng = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, {
        pixelRatio: 2,
        backgroundColor: theme.background,
        style: { font: "14px system-ui, sans-serif" },
        skipFonts: true,
      });
      const link = document.createElement("a");
      link.download = `repostars-${repoNames.map((n) => n.replace("/", "-")).join("_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [chartRef, repoNames, theme]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" size="sm" onClick={exportPng}>
        Export PNG
      </Button>
      <Button variant="outline" size="sm" onClick={copyLink}>
        {copied ? "Copied!" : "Copy Link"}
      </Button>
    </div>
  );
}

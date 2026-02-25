"use client";

import { useCallback, useMemo, useState } from "react";
import { toPng } from "html-to-image";
import { Check, Copy } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { ChartTheme } from "@/lib/themes";

interface ExportBarProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  repoNames: string[];
  theme: ChartTheme;
}

export function ExportBar({ chartRef, repoNames, theme }: ExportBarProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const embedCode = useMemo(() => {
    if (repoNames.length === 0) return "";
    const repo = repoNames[0];
    const themeId = theme.id || "dark";
    return `![RepoStars](https://repostars.dev/api/embed?repo=${encodeURIComponent(repo)}&theme=${encodeURIComponent(themeId)})`;
  }, [repoNames, theme.id]);

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
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  const copyReadmeEmbed = useCallback(() => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  }, [embedCode]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={exportPng}>
          Export PNG
        </Button>
        <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
          {linkCopied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
        </Button>
      </div>

      {embedCode && (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <code className="truncate font-mono text-xs text-muted-foreground">
            {embedCode}
          </code>
          <Button variant="ghost" size="icon" onClick={copyReadmeEmbed} aria-label="Copy README embed code">
            {embedCopied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
          </Button>
        </div>
      )}
    </div>
  );
}

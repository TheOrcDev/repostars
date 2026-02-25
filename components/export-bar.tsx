"use client";

import { useCallback, useMemo, useState } from "react";
import { toPng } from "html-to-image";
import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChartTheme } from "@/lib/themes";

interface ExportBarProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  repoNames: string[];
  theme: ChartTheme;
}

export function ExportBar({ chartRef, repoNames, theme }: ExportBarProps) {
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
  }, []);

  const shareOnX = useCallback(() => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent("Compare GitHub stars with RepoStars");
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
  }, []);

  const copyReadmeEmbed = useCallback(() => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  }, [embedCode]);

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Share
        </p>
        <div className="flex flex-wrap gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Share options">
                <ShareNetwork size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportPng}>Export PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={copyLink}>Copy URL</DropdownMenuItem>
              <DropdownMenuItem onClick={shareOnX}>Share on X</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {embedCode && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            README Embed
          </p>
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <code className="truncate font-mono text-xs text-muted-foreground">
              {embedCode}
            </code>
            <Button variant="ghost" size="icon" onClick={copyReadmeEmbed} aria-label="Copy README embed code">
              {embedCopied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

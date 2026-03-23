"use client";

import {
  Check,
  Copy,
  DownloadSimple,
  LinkSimple,
  XLogo,
} from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChartTheme } from "@/lib/themes";

interface ExportBarProps {
  repoNames: string[];
  theme: ChartTheme;
}

interface HeaderShareActionsProps extends ExportBarProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
}

function useShareActions({
  chartRef,
  repoNames,
  theme,
}: HeaderShareActionsProps) {
  const exportPng = useCallback(async () => {
    if (!chartRef.current) {
      return;
    }
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
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  return { copyLink, exportPng, shareOnX };
}

interface ShareActionsProps {
  onCopyLink: () => void;
  onExportPng: () => void;
  onShareOnX: () => void;
}

function ShareActions({
  onCopyLink,
  onExportPng,
  onShareOnX,
}: ShareActionsProps) {
  const shareActions = [
    {
      icon: DownloadSimple,
      key: "png",
      label: "PNG",
      onClick: onExportPng,
      srLabel: "Export chart as PNG",
    },
    {
      icon: LinkSimple,
      key: "link",
      label: "Copy URL",
      onClick: onCopyLink,
      srLabel: "Copy chart URL",
    },
    {
      icon: XLogo,
      key: "x",
      label: "Share X",
      onClick: onShareOnX,
      srLabel: "Share chart on X",
    },
  ] as const;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <TooltipProvider>
        {shareActions.map(({ icon: Icon, key, label, onClick, srLabel }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button
                aria-label={srLabel}
                className="min-w-0 gap-2 border-border/70 bg-background/90 sm:min-w-[7.25rem]"
                onClick={onClick}
                size="sm"
                variant="outline"
              >
                <Icon size={16} weight="bold" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{srLabel}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="sm:hidden" side="bottom" sideOffset={8}>
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}

export function ExportBar({ repoNames, theme }: ExportBarProps) {
  const [embedCopied, setEmbedCopied] = useState(false);

  const embedCode = useMemo(() => {
    if (repoNames.length === 0) {
      return "";
    }
    const repo = repoNames[0];
    const themeId = theme.id || "dark";
    const img = `https://repostars.dev/api/embed?repo=${encodeURIComponent(repo)}&theme=${encodeURIComponent(themeId)}`;
    const link = `https://repostars.dev/?repos=${encodeURIComponent(repo)}&theme=${encodeURIComponent(themeId)}`;
    return `[![RepoStars](${img})](${link})`;
  }, [repoNames, theme.id]);

  const copyReadmeEmbed = useCallback(() => {
    if (!embedCode) {
      return;
    }
    navigator.clipboard.writeText(embedCode);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  }, [embedCode]);

  return embedCode ? (
    <div>
      <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
        README Embed
      </p>
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <code className="truncate font-mono text-muted-foreground text-xs">
          {embedCode}
        </code>
        <Button
          aria-label="Copy README embed code"
          onClick={copyReadmeEmbed}
          size="icon"
          variant="ghost"
        >
          {embedCopied ? (
            <Check size={16} weight="bold" />
          ) : (
            <Copy size={16} weight="bold" />
          )}
        </Button>
      </div>
    </div>
  ) : null;
}

export function HeaderShareActions({
  chartRef,
  repoNames,
  theme,
}: HeaderShareActionsProps) {
  const { copyLink, exportPng, shareOnX } = useShareActions({
    chartRef,
    repoNames,
    theme,
  });

  return (
    <ShareActions
      onCopyLink={copyLink}
      onExportPng={exportPng}
      onShareOnX={shareOnX}
    />
  );
}

"use client";

import {
  CodeSimple,
  DownloadSimple,
  LinkSimple,
  XLogo,
} from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import { useCallback } from "react";
import { toast } from "sonner";
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

// Slack added to each label so a wider fallback face still fits its frozen box.
const LABEL_EXPORT_SLACK_PX = 32;

/**
 * html-to-image clones the chart with every element's width frozen at its live
 * value, then rasterises that clone without the page's web fonts. The fallback
 * face is wider, so labels that fit on screen lose characters to their
 * ellipsis. Widening the labels before the snapshot keeps them intact; the
 * returned callback puts the live DOM back.
 */
function relaxLabelClipping(root: HTMLElement) {
  const labels = Array.from(
    root.querySelectorAll<HTMLElement>("[data-legend-label]")
  );
  const previous = labels.map((label) => label.getAttribute("style"));

  for (const label of labels) {
    const width = label.getBoundingClientRect().width;
    label.style.textOverflow = "clip";
    label.style.width = `${Math.ceil(width) + LABEL_EXPORT_SLACK_PX}px`;
  }

  return () => {
    labels.forEach((label, index) => {
      const style = previous[index];
      if (style === null) {
        label.removeAttribute("style");
      } else {
        label.setAttribute("style", style);
      }
    });
  };
}

/** Markdown snippet that embeds the first repo's chart in a README. */
function readmeEmbedCode(repoNames: string[], themeId: string) {
  const repo = repoNames[0];
  if (!repo) {
    return "";
  }
  const img = `https://repostars.dev/api/embed?repo=${encodeURIComponent(repo)}&theme=${encodeURIComponent(themeId)}`;
  const link = `https://repostars.dev/?repos=${encodeURIComponent(repo)}&theme=${encodeURIComponent(themeId)}`;
  return `[![RepoStars](${img})](${link})`;
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
    const restoreLabels = relaxLabelClipping(chartRef.current);
    try {
      const dataUrl = await toPng(chartRef.current, {
        pixelRatio: 2,
        backgroundColor: theme.background,
        // Optional insights and their toggle never belong in the image.
        filter: (node) =>
          !(node instanceof HTMLElement && "exportExclude" in node.dataset),
        skipFonts: true,
      });
      const link = document.createElement("a");
      link.download = `repostars-${repoNames.map((n) => n.replace("/", "-")).join("_")}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Chart exported as PNG");
    } catch {
      toast.error("Couldn’t export the chart");
    } finally {
      restoreLabels();
    }
  }, [chartRef, repoNames, theme]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Chart URL copied");
    } catch {
      toast.error("Couldn’t copy the chart URL");
    }
  }, []);

  const copyEmbed = useCallback(async () => {
    const embedCode = readmeEmbedCode(repoNames, theme.id || "dark");
    if (!embedCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success("README embed copied");
    } catch {
      toast.error("Couldn’t copy the README embed");
    }
  }, [repoNames, theme.id]);

  const shareOnX = useCallback(() => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent("Compare GitHub stars with RepoStars");
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  return { copyEmbed, copyLink, exportPng, shareOnX };
}

interface ShareActionsProps {
  onCopyEmbed: () => void;
  onCopyLink: () => void;
  onExportPng: () => void;
  onShareOnX: () => void;
}

function ShareActions({
  onCopyEmbed,
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
      icon: CodeSimple,
      key: "embed",
      label: "Embed",
      onClick: onCopyEmbed,
      srLabel: "Copy README embed code",
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
                <Icon data-icon="inline-start" size={16} weight="bold" />
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

export function HeaderShareActions({
  chartRef,
  repoNames,
  theme,
}: HeaderShareActionsProps) {
  const { copyEmbed, copyLink, exportPng, shareOnX } = useShareActions({
    chartRef,
    repoNames,
    theme,
  });

  return (
    <ShareActions
      onCopyEmbed={copyEmbed}
      onCopyLink={copyLink}
      onExportPng={exportPng}
      onShareOnX={shareOnX}
    />
  );
}

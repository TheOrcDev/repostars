"use client";

import {
  CodeSimple,
  DownloadSimple,
  LinkSimple,
  XLogo,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { exportFilename } from "@/lib/og/export-filename";
import type { ChartTheme } from "@/lib/themes";

interface HeaderShareActionsProps {
  repoNames: string[];
  theme: ChartTheme;
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

function exportUrl(repoNames: string[], themeId: string) {
  const params = new URLSearchParams({
    repos: repoNames.join(","),
    theme: themeId,
  });
  return `/api/export?${params.toString()}`;
}

/**
 * Hand a rendered PNG to the user. Phones get the share sheet (with "Save
 * Image") when the browser can share files; everything else gets a download.
 * Returns false when the user dismissed the share sheet.
 */
async function saveImage(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return false;
      }
      // Fall through to a plain download if sharing is refused.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}

function useShareActions({ repoNames, theme }: HeaderShareActionsProps) {
  const [exporting, setExporting] = useState(false);

  const exportPng = useCallback(async () => {
    if (repoNames.length === 0 || exporting) {
      return;
    }
    setExporting(true);
    try {
      const response = await fetch(exportUrl(repoNames, theme.id));
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      const saved = await saveImage(
        await response.blob(),
        exportFilename(repoNames)
      );
      if (saved) {
        toast.success("Chart exported as PNG");
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? `Couldn’t export the chart: ${error.message}`
          : "Couldn’t export the chart"
      );
    } finally {
      setExporting(false);
    }
  }, [exporting, repoNames, theme.id]);

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

  return { copyEmbed, copyLink, exportPng, exporting, shareOnX };
}

interface ShareActionsProps {
  exporting: boolean;
  onCopyEmbed: () => void;
  onCopyLink: () => void;
  onExportPng: () => void;
  onShareOnX: () => void;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
    />
  );
}

function ShareActions({
  exporting,
  onCopyEmbed,
  onCopyLink,
  onExportPng,
  onShareOnX,
}: ShareActionsProps) {
  const shareActions = [
    {
      busy: exporting,
      icon: DownloadSimple,
      key: "png",
      label: "PNG",
      onClick: onExportPng,
      srLabel: "Export chart as PNG",
    },
    {
      busy: false,
      icon: LinkSimple,
      key: "link",
      label: "Copy URL",
      onClick: onCopyLink,
      srLabel: "Copy chart URL",
    },
    {
      busy: false,
      icon: CodeSimple,
      key: "embed",
      label: "Embed",
      onClick: onCopyEmbed,
      srLabel: "Copy README embed code",
    },
    {
      busy: false,
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
        {shareActions.map(
          ({ busy, icon: Icon, key, label, onClick, srLabel }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Button
                  aria-busy={busy}
                  aria-label={srLabel}
                  className="min-w-0 gap-2 border-border/70 bg-background/90 sm:min-w-[7.25rem]"
                  disabled={busy}
                  onClick={onClick}
                  size="sm"
                  variant="outline"
                >
                  {busy ? (
                    <Spinner />
                  ) : (
                    <Icon data-icon="inline-start" size={16} weight="bold" />
                  )}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sr-only sm:hidden">{srLabel}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent
                className="sm:hidden"
                side="bottom"
                sideOffset={8}
              >
                {label}
              </TooltipContent>
            </Tooltip>
          )
        )}
      </TooltipProvider>
    </div>
  );
}

export function HeaderShareActions({
  repoNames,
  theme,
}: HeaderShareActionsProps) {
  const { copyEmbed, copyLink, exportPng, exporting, shareOnX } =
    useShareActions({ repoNames, theme });

  return (
    <ShareActions
      exporting={exporting}
      onCopyEmbed={copyEmbed}
      onCopyLink={copyLink}
      onExportPng={exportPng}
      onShareOnX={shareOnX}
    />
  );
}

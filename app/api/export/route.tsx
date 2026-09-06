import type { NextRequest } from "next/server";
import { exportFilename } from "@/lib/og/export-filename";
import { parseOgRequest, renderOg } from "@/lib/og/render-og";

/**
 * PNG download at 2x. Unlike the share image this fails loudly: a download
 * must never quietly save the brand card under a repository's filename.
 */
export function GET(req: NextRequest) {
  const { names, themeId } = parseOgRequest(req.url);
  return renderOg({
    fallback: "error",
    headers: {
      "Content-Disposition": `attachment; filename="${exportFilename(names)}"`,
    },
    names,
    scale: 2,
    themeId,
  });
}

import type { NextRequest } from "next/server";
import { parseOgRequest, renderOg } from "@/lib/og/render-og";

/** Link-preview image. Always returns a picture, even when GitHub is down. */
export function GET(req: NextRequest) {
  const { names, themeId } = parseOgRequest(req.url);
  return renderOg({ fallback: "card", names, themeId });
}

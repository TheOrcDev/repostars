import { NextRequest, NextResponse } from "next/server";
import { getRepoInfo, getStarHistory } from "@/lib/github";

// Revalidate cached responses every 24h
export const revalidate = 86400;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;

  try {
    const info = await getRepoInfo(owner, repo);
    const history = await getStarHistory(owner, repo, info);

    return NextResponse.json(
      { info, history },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=172800",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to fetch star data",
      },
      {
        status:
          e instanceof Error && e.message.includes("rate limit") ? 429 : 404,
      }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCachedStarData } from "@/lib/star-cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;

  try {
    const { info, history } = await getCachedStarData(owner, repo);

    return NextResponse.json(
      { info, history },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=21600, stale-while-revalidate=43200",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to fetch star data",
      },
      { status: e instanceof Error && e.message.includes("rate limit") ? 429 : 404 }
    );
  }
}

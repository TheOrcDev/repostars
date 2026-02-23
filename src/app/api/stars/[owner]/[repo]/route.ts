import { NextRequest, NextResponse } from "next/server";
import { getStarHistory, getRepoInfo } from "@/lib/github";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;

  try {
    const [info, history] = await Promise.all([
      getRepoInfo(owner, repo),
      getStarHistory(owner, repo),
    ]);

    return NextResponse.json({ info, history }, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch star data" },
      { status: 404 }
    );
  }
}

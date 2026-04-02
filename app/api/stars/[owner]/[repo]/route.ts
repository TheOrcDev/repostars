import { type NextRequest, NextResponse } from "next/server";
import { getRepoDataCached } from "@/lib/repo-cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;

  try {
    const { info, history } = await getRepoDataCached(owner, repo, "v3");

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
    const message = e instanceof Error ? e.message : "";
    const isRateLimit = message.includes("rate limit");

    return NextResponse.json(
      {
        error: isRateLimit
          ? "GitHub API rate limit exceeded. Please try again later."
          : `Repository "${owner}/${repo}" not found. Please check the name and try again.`,
      },
      { status: isRateLimit ? 429 : 404 }
    );
  }
}

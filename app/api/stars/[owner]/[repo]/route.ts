import { type NextRequest, NextResponse } from "next/server";
import { getRepoData } from "@/lib/repo-cache";

function errorStatus(error: unknown) {
  if (error instanceof Error && error.message.includes("rate limit")) {
    return 429;
  }
  if (error instanceof Error && error.message.startsWith("Repo not found:")) {
    return 404;
  }
  return 502;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;

  try {
    const { estimated, info, history } = await getRepoData(owner, repo);

    return NextResponse.json(
      { estimated, info, history },
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
        status: errorStatus(e),
      }
    );
  }
}

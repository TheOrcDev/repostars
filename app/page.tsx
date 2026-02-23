"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { StarChart } from "@/components/star-chart";
import { ThemePicker } from "@/components/theme-picker";
import { RepoSearch } from "@/components/repo-search";
import { RepoChips } from "@/components/repo-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { themes, defaultTheme } from "@/lib/themes";
import type { StarDataPoint, RepoInfo } from "@/lib/github";

interface LoadedRepo {
  info: RepoInfo;
  history: StarDataPoint[];
}

export default function Home() {
  const [themeId, setThemeId] = useState(defaultTheme);
  const [repos, setRepos] = useState<LoadedRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const theme = themes[themeId];

  // Load repos and theme from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get("theme");
    if (urlTheme && themes[urlTheme]) setThemeId(urlTheme);

    const urlRepos = params.get("repos");
    if (urlRepos) {
      const repoList = urlRepos.split(",").filter(Boolean);
      (async () => {
        for (const fullName of repoList) {
          const [owner, repo] = fullName.split("/");
          if (!owner || !repo) continue;
          try {
            const res = await fetch(`/api/stars/${owner}/${repo}`);
            const data = await res.json();
            if (res.ok) {
              setRepos((prev) => {
                if (prev.some((r) => r.info.fullName.toLowerCase() === `${owner}/${repo}`.toLowerCase())) return prev;
                return [...prev, { info: data.info, history: data.history }];
              });
            }
          } catch {}
        }
      })();
    }
  }, []);

  const addRepo = useCallback(
    async (owner: string, repo: string) => {
      const fullName = `${owner}/${repo}`;

      if (
        repos.some(
          (r) => r.info.fullName.toLowerCase() === fullName.toLowerCase()
        )
      ) {
        setError("Repo already added");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/stars/${owner}/${repo}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to fetch repo");
          return;
        }

        setRepos((prev) => [
          ...prev,
          { info: data.info, history: data.history },
        ]);
      } catch {
        setError("Failed to fetch star data");
      } finally {
        setLoading(false);
      }
    },
    [repos]
  );

  const removeRepo = useCallback((name: string) => {
    setRepos((prev) => prev.filter((r) => r.info.fullName !== name));
  }, []);

  const exportPng = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, {
        pixelRatio: 2,
        backgroundColor: theme.background,
        style: {
          font: "14px system-ui, sans-serif",
        },
        skipFonts: true,
      });
      const link = document.createElement("a");
      link.download = `star-history-${repos.map((r) => r.info.fullName.replace("/", "-")).join("_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [repos, theme]);

  const copyLink = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set(
      "repos",
      repos.map((r) => r.info.fullName).join(",")
    );
    url.searchParams.set("theme", themeId);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [repos, themeId]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero */}
      <div className="mb-12 text-center">
        <p className="text-lg text-muted-foreground">
          Track and compare GitHub star history with beautiful charts
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <RepoSearch
          onAdd={addRepo}
          loading={loading}
          repoCount={repos.length}
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>

      {/* Repo chips */}
      {repos.length > 0 && (
        <div className="mb-4">
          <RepoChips
            repos={repos.map((r) => ({
              name: r.info.fullName,
              stars: r.info.stars,
            }))}
            themeId={themeId}
            onRemove={removeRepo}
          />
        </div>
      )}

      {/* Chart */}
      {repos.length > 0 ? (
        <div className="mb-6">
          <StarChart
            ref={chartRef}
            repos={repos.map((r) => ({
              name: r.info.fullName,
              data: r.history,
            }))}
            theme={theme}
          />
        </div>
      ) : (
        <Card className="mb-6">
          <CardContent className="flex h-[400px] items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="mb-2 text-5xl">★</p>
              <p className="text-lg">Add a repo to see its star history</p>
              <p className="mt-2 text-sm">
                Try{" "}
                <button
                  onClick={() => addRepo("facebook", "react")}
                  className="text-primary underline decoration-primary/30 hover:decoration-primary"
                >
                  facebook/react
                </button>
                {" or "}
                <button
                  onClick={() => addRepo("vercel", "next.js")}
                  className="text-primary underline decoration-primary/30 hover:decoration-primary"
                >
                  vercel/next.js
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme picker */}
      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Theme
        </p>
        <ThemePicker current={themeId} onChange={setThemeId} />
      </div>

      {/* Share/Export */}
      {repos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={exportPng}>
            Export PNG
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 border-t pt-6 text-center text-sm text-muted-foreground">
        <p>
          Built by{" "}
          <a
            href="https://github.com/TheOrcDev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/70 hover:text-foreground"
          >
            OrcDev
          </a>
          {" · "}
          <a
            href="https://github.com/TheOrcDev/star-history"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/70 hover:text-foreground"
          >
            Source
          </a>
        </p>
      </footer>
    </main>
  );
}

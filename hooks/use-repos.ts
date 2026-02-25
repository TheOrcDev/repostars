"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { themes, defaultTheme } from "@/lib/themes";
import type { StarDataPoint, RepoInfo } from "@/lib/github";

export interface LoadedRepo {
  info: RepoInfo;
  history: StarDataPoint[];
}

interface UseReposOptions {
  initialRepos?: LoadedRepo[];
  initialTheme?: string;
  initialReposParam?: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CLIENT_CACHE_VERSION = "v2";

function cacheKey(fullName: string) {
  return `repostars:repo:${CLIENT_CACHE_VERSION}:${fullName.toLowerCase()}`;
}

function readCachedRepo(fullName: string): LoadedRepo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(fullName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: LoadedRepo };
    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedRepo(repo: LoadedRepo) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      cacheKey(repo.info.fullName),
      JSON.stringify({ ts: Date.now(), data: repo })
    );
  } catch {}
}

export function useRepos({
  initialRepos = [],
  initialTheme,
  initialReposParam = "",
}: UseReposOptions = {}) {
  const [themeId, setThemeId] = useQueryState(
    "theme",
    parseAsString
      .withDefault(initialTheme || defaultTheme)
      .withOptions({ history: "replace" })
  );
  const [reposParam, setReposParam] = useQueryState(
    "repos",
    parseAsString.withDefault(initialReposParam).withOptions({ history: "replace" })
  );

  const [repos, setRepos] = useState<LoadedRepo[]>(initialRepos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedFromUrl, setLoadedFromUrl] = useState(false);

  const theme = themes[themeId] || themes[defaultTheme];

  const updateReposParam = useCallback(
    (loadedRepos: LoadedRepo[]) => {
      const value = loadedRepos.map((r) => r.info.fullName).join(",");
      setReposParam(value || null);
    },
    [setReposParam]
  );

  const mergeRepos = useCallback((next: LoadedRepo[]) => {
    setRepos((prev) => {
      const map = new Map(prev.map((r) => [r.info.fullName.toLowerCase(), r]));
      for (const repo of next) map.set(repo.info.fullName.toLowerCase(), repo);
      return Array.from(map.values());
    });
  }, []);

  // Instant render from local cache, then refresh from network.
  useEffect(() => {
    if (loadedFromUrl) return;
    if (!reposParam) {
      setLoadedFromUrl(true);
      return;
    }

    const repoList = reposParam.split(",").filter(Boolean).slice(0, 5);

    // 1) Hydrate instantly from localStorage
    const cached = repoList
      .map((name) => readCachedRepo(name))
      .filter((r): r is LoadedRepo => Boolean(r));
    if (cached.length > 0) mergeRepos(cached);

    // 2) Refresh in background (and fill misses)
    (async () => {
      setLoading(true);
      try {
        const fetched = await Promise.all(
          repoList.map(async (fullName) => {
            const [owner, repo] = fullName.split("/");
            if (!owner || !repo) return null;
            try {
              const res = await fetch(`/api/stars/${owner}/${repo}`);
              const data = await res.json();
              if (!res.ok) return null;
              const loaded: LoadedRepo = { info: data.info, history: data.history };
              writeCachedRepo(loaded);
              return loaded;
            } catch {
              return null;
            }
          })
        );
        mergeRepos(fetched.filter((r): r is LoadedRepo => Boolean(r)));
      } finally {
        setLoading(false);
        setLoadedFromUrl(true);
      }
    })();
  }, [reposParam, loadedFromUrl, mergeRepos]);

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

        const loaded: LoadedRepo = { info: data.info, history: data.history };
        writeCachedRepo(loaded);

        const updated = [...repos, loaded];
        setRepos(updated);
        updateReposParam(updated);
      } catch {
        setError("Failed to fetch star data");
      } finally {
        setLoading(false);
      }
    },
    [repos, updateReposParam]
  );

  const removeRepo = useCallback(
    (name: string) => {
      const updated = repos.filter((r) => r.info.fullName !== name);
      setRepos(updated);
      updateReposParam(updated);
    },
    [repos, updateReposParam]
  );

  return {
    repos,
    loading,
    error,
    themeId,
    theme,
    setThemeId,
    addRepo,
    removeRepo,
  };
}

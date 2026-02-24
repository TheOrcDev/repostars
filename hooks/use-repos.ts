"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { themes, defaultTheme } from "@/lib/themes";
import type { StarDataPoint, RepoInfo } from "@/lib/github";

export interface LoadedRepo {
  info: RepoInfo;
  history: StarDataPoint[];
}

export function useRepos() {
  const [themeId, setThemeId] = useQueryState(
    "theme",
    parseAsString.withDefault(defaultTheme).withOptions({ history: "replace" })
  );
  const [reposParam, setReposParam] = useQueryState(
    "repos",
    parseAsString.withDefault("").withOptions({ history: "replace" })
  );

  const [repos, setRepos] = useState<LoadedRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  const theme = themes[themeId] || themes[defaultTheme];

  const updateReposParam = useCallback(
    (loadedRepos: LoadedRepo[]) => {
      const value = loadedRepos.map((r) => r.info.fullName).join(",");
      setReposParam(value || null);
    },
    [setReposParam]
  );

  // Load repos from URL on mount
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    if (!reposParam) return;

    const repoList = reposParam.split(",").filter(Boolean);
    (async () => {
      for (const fullName of repoList) {
        const [owner, repo] = fullName.split("/");
        if (!owner || !repo) continue;
        try {
          const res = await fetch(`/api/stars/${owner}/${repo}`);
          const data = await res.json();
          if (res.ok) {
            setRepos((prev) => {
              if (
                prev.some(
                  (r) =>
                    r.info.fullName.toLowerCase() ===
                    `${owner}/${repo}`.toLowerCase()
                )
              )
                return prev;
              return [...prev, { info: data.info, history: data.history }];
            });
          }
        } catch {}
      }
    })();
  }, [reposParam, initialized]);

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

        const updated = [...repos, { info: data.info, history: data.history }];
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

"use client";

import { useState, type FormEvent } from "react";

interface RepoSearchProps {
  onAdd: (owner: string, repo: string) => void;
  loading: boolean;
  repoCount: number;
}

function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/$/, "");

  // Full URL: https://github.com/owner/repo
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)/
  );
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };

  // Short form: owner/repo
  const shortMatch = trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };

  return null;
}

export function RepoSearch({ onAdd, loading, repoCount }: RepoSearchProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseRepoInput(input);
    if (!parsed) {
      setError('Enter a GitHub repo like "owner/repo" or paste a URL');
      return;
    }
    if (repoCount >= 5) {
      setError("Maximum 5 repos for comparison");
      return;
    }
    onAdd(parsed.owner, parsed.repo);
    setInput("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="owner/repo or GitHub URL"
          className="flex-1 rounded-xl border border-[#333] bg-[#111] px-4 py-3 text-white placeholder-[#555] outline-none transition-colors focus:border-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
        >
          {loading ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            "Add"
          )}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}

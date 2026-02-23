"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="owner/repo or GitHub URL"
          disabled={loading}
          className="h-11"
        />
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-11 px-6"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          ) : (
            "Add"
          )}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}

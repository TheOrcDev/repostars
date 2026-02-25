"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const TRAILING_SLASH_RE = /\/$/;
const GITHUB_URL_RE = /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)/;
const OWNER_REPO_RE = /^([^/]+)\/([^/]+)$/;

const repoSchema = z.object({
  repo: z
    .string()
    .min(1, "Enter a repo")
    .refine(
      (val) => {
        const trimmed = val.trim().replace(TRAILING_SLASH_RE, "");
        const urlMatch = trimmed.match(GITHUB_URL_RE);
        const shortMatch = trimmed.match(OWNER_REPO_RE);
        return urlMatch || shortMatch;
      },
      { message: 'Use "owner/repo" or paste a GitHub URL' }
    ),
});

type RepoFormValues = z.infer<typeof repoSchema>;

function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(TRAILING_SLASH_RE, "");
  const urlMatch = trimmed.match(GITHUB_URL_RE);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }
  const shortMatch = trimmed.match(OWNER_REPO_RE);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }
  return null;
}

interface RepoSearchProps {
  loading: boolean;
  onAdd: (owner: string, repo: string) => void;
  repoCount: number;
}

export function RepoSearch({ onAdd, loading, repoCount }: RepoSearchProps) {
  const form = useForm<RepoFormValues>({
    // zod v4 typing mismatch with @hookform/resolvers in current versions
    resolver: zodResolver(repoSchema as never) as never,
    defaultValues: { repo: "" },
  });

  function onSubmit(data: RepoFormValues) {
    if (repoCount >= 5) {
      form.setError("repo", { message: "Maximum 5 repos for comparison" });
      return;
    }
    const parsed = parseRepoInput(data.repo);
    if (parsed) {
      onAdd(parsed.owner, parsed.repo);
      form.reset();
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Controller
        control={form.control}
        name="repo"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <ButtonGroup>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                autoComplete="off"
                disabled={loading}
                id={field.name}
                placeholder="owner/repo or GitHub URL"
              />
              <Button
                disabled={loading || !form.watch("repo").trim()}
                type="submit"
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                ) : (
                  "Add"
                )}
              </Button>
            </ButtonGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  );
}

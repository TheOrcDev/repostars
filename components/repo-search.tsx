"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldError } from "@/components/ui/field";

const repoSchema = z.object({
  repo: z
    .string()
    .min(1, "Enter a repo")
    .refine(
      (val) => {
        const trimmed = val.trim().replace(/\/$/, "");
        const urlMatch = trimmed.match(
          /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)/
        );
        const shortMatch = trimmed.match(/^([^/]+)\/([^/]+)$/);
        return urlMatch || shortMatch;
      },
      { message: 'Use "owner/repo" or paste a GitHub URL' }
    ),
});

type RepoFormValues = z.infer<typeof repoSchema>;

function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/$/, "");
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)/
  );
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
  const shortMatch = trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };
  return null;
}

interface RepoSearchProps {
  onAdd: (owner: string, repo: string) => void;
  loading: boolean;
  repoCount: number;
}

export function RepoSearch({ onAdd, loading, repoCount }: RepoSearchProps) {
  const form = useForm<RepoFormValues>({
    resolver: zodResolver(repoSchema),
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
      <Controller
        name="repo"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <ButtonGroup>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="owner/repo or GitHub URL"
                disabled={loading}
                autoComplete="off"
              />
              <Button
                type="submit"
                disabled={loading || !form.watch("repo").trim()}
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                ) : (
                  "Add"
                )}
              </Button>
            </ButtonGroup>
            {fieldState.invalid && (
              <FieldError errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />
    </form>
  );
}

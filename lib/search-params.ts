import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsCache = createSearchParamsCache({
  repos: parseAsString.withDefault(""),
  theme: parseAsString.withDefault("dark"),
});

import type { MetadataRoute } from "next";

const SITE_URL = "https://repostars.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "weekly",
      priority: 1,
      url: SITE_URL,
    },
  ];
}

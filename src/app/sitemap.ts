import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl;
  return ["", "/roster", "/progression", "/raids", "/recruitment", "/apply"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/recruitment" || path === "/apply" ? 0.9 : 0.6,
  }));
}

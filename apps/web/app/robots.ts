import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cashow.local";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/setup"],
        disallow: ["/app/", "/api/", "/compat/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

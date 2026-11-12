import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/login"],
      },
    ],
    sitemap: "https://achadosdocasal.com.br/sitemap.xml",
    host: "https://achadosdocasal.com.br",
  };
}

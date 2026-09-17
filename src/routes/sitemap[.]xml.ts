import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { absolute, sitemapUrls } from "@/content/registry";
import { blogDataProvider } from "@/content/blog";

/**
 * Sitemap inclusion for the static registry depends ONLY on:
 *   buildStatus === "built" && indexation === "index".
 * Optional/proof block availability never affects it.
 *
 * Blog articles are WordPress-driven, so they live outside the registry and
 * are appended separately by walking every published-post page.
 */
async function blogSitemapEntries(): Promise<{ url: string; lastmod?: string }[]> {
  const perPage = 50;
  const entries: { url: string; lastmod?: string }[] = [];
  let page = 1;
  while (true) {
    const { items, pagination } = await blogDataProvider.listArticles({ page, perPage });
    for (const item of items) {
      entries.push({ url: `/blog/${item.slug}`, ...((item.updatedAt ?? item.publishedAt) ? { lastmod: item.updatedAt ?? item.publishedAt } : {}) });
    }
    if (page >= pagination.totalPages || items.length === 0) break;
    page += 1;
  }
  return entries;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = sitemapUrls().map((record) =>
          [
            "  <url>",
            `    <loc>${absolute(record.url)}</loc>`,
            `    <priority>${record.priority === "P1" ? "1.0" : record.priority === "P2" ? "0.7" : "0.5"}</priority>`,
            record.lastVerified ? `    <lastmod>${record.lastVerified}</lastmod>` : null,
            "  </url>",
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const blogEntries = await blogSitemapEntries();
        const blogUrls = blogEntries.map(({ url, lastmod }) =>
          [
            "  <url>",
            `    <loc>${absolute(url)}</loc>`,
            `    <priority>0.6</priority>`,
            lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
            "  </url>",
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          ...blogUrls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { absolute, sitemapUrls } from "@/content/registry";
import { blogDataProvider } from "@/content/blog";
import { site } from "@/content/site";

/**
 * llms.txt (see llmstxt.org): a curated, plain-text index of a site's real
 * content for AI assistants to read. Content mirrors sitemap.xml's
 * inclusion rule (built + index for static pages, every published post for
 * the blog) so this never lists a page search engines are told to skip.
 *
 * This intentionally lives only on ranksarthi.com. WordPress (Yoast) can
 * also generate one, but it would describe cms.ranksarthi.com — the
 * noindex, non-canonical backend — pointing AI tools at the wrong domain.
 */
async function blogEntries(): Promise<{ title: string; url: string; excerpt: string }[]> {
  const perPage = 50;
  const entries: { title: string; url: string; excerpt: string }[] = [];
  let page = 1;
  while (true) {
    const { items, pagination } = await blogDataProvider.listArticles({ page, perPage });
    for (const item of items) {
      entries.push({ title: item.title, url: `/blog/${item.slug}`, excerpt: item.excerpt });
    }
    if (page >= pagination.totalPages || items.length === 0) break;
    page += 1;
  }
  return entries;
}

function escape(text: string): string {
  return text.replace(/\]/g, "\\]");
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const pages = sitemapUrls().map((record) => `- [${escape(record.name)}](${absolute(record.url)})`);
        const posts = (await blogEntries()).map(
          ({ title, url, excerpt }) => `- [${escape(title)}](${absolute(url)}): ${excerpt}`,
        );

        const lines = [
          `# ${site.name}`,
          "",
          `> ${site.description}`,
          "",
          "## Pages",
          ...pages,
          "",
          "## Blog",
          ...posts,
        ];

        return new Response(lines.join("\n") + "\n", {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});

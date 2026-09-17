import { createFileRoute } from "@tanstack/react-router";
import { fetchBlogArticleBySlug } from "@/server/wordpress-blog";

/**
 * Real endpoint (not createServerOnlyFn) — see blog-list.ts for why: the
 * article loader can re-run client-side during a SPA navigation.
 */
export const Route = createFileRoute("/api/public/blog-article")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug");
        if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
        const article = await fetchBlogArticleBySlug(slug);
        if (!article) return Response.json(null, { status: 404 });
        return Response.json(article);
      },
    },
  },
});

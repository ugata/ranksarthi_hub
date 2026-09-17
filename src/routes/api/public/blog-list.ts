import { createFileRoute } from "@tanstack/react-router";
import { fetchBlogList } from "@/server/wordpress-blog";
import type { BlogCategory, BlogListParams } from "@/content/blog";

const CATEGORIES: BlogCategory[] = ["JEE", "NEET", "NDA", "Exam Updates", "Preparation Strategy", "Study Resources"];

/**
 * Real endpoint (not createServerOnlyFn) because the blog list loader can
 * re-run client-side during a SPA navigation (e.g. clicking "Blog" while
 * already on /blog), and createServerOnlyFn throws by design when called
 * outside a server request context.
 */
export const Route = createFileRoute("/api/public/blog-list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page"));
        const perPage = Number(url.searchParams.get("perPage"));
        const category = CATEGORIES.find((c) => c === url.searchParams.get("category"));
        const tag = url.searchParams.get("tag") ?? undefined;
        const params: BlogListParams = {
          ...(Number.isFinite(page) && page > 0 ? { page } : {}),
          ...(Number.isFinite(perPage) && perPage > 0 ? { perPage } : {}),
          ...(category ? { category } : {}),
          ...(tag ? { tag } : {}),
        };
        const result = await fetchBlogList(params);
        return Response.json(result);
      },
    },
  },
});

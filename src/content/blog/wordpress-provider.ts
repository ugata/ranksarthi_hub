import type {
  BlogArticle,
  BlogComment,
  BlogCommentInput,
  BlogCommentResult,
  BlogDataProvider,
  BlogListParams,
  BlogListResult,
} from "./types";

/**
 * All reads and writes go through real /api/public/* endpoints (see
 * src/routes/api/public/) rather than createServerOnlyFn: a route loader
 * using this provider can re-run client-side during a SPA navigation (e.g.
 * clicking "Blog" while already on /blog), and createServerOnlyFn throws by
 * design when called outside a server request context. A plain fetch works
 * the same way whether it runs during SSR or in the browser.
 *
 * Server-side, fetch() has no implicit base URL, so requests go over
 * loopback to this same process; client-side, a relative path resolves
 * against the page origin.
 */
function apiBase(): string {
  if (typeof window !== "undefined") return "";
  const port = process.env["PORT"] ?? "3000";
  return `http://127.0.0.1:${port}`;
}

export class WordPressBlogDataProvider implements BlogDataProvider {
  async listArticles(params?: BlogListParams): Promise<BlogListResult> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.perPage) query.set("perPage", String(params.perPage));
    if (params?.category) query.set("category", params.category);
    if (params?.tag) query.set("tag", params.tag);
    const res = await fetch(`${apiBase()}/api/public/blog-list?${query.toString()}`);
    if (!res.ok) throw new Error(`Failed to load blog list (${res.status}).`);
    return (await res.json()) as BlogListResult;
  }

  async getArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
    const res = await fetch(`${apiBase()}/api/public/blog-article?slug=${encodeURIComponent(slug)}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`Failed to load blog article (${res.status}).`);
    const body = (await res.json()) as BlogArticle | null;
    return body ?? undefined;
  }

  async listComments(articleId: string): Promise<BlogComment[]> {
    const res = await fetch(`${apiBase()}/api/public/blog-comments?postId=${encodeURIComponent(articleId)}`);
    if (!res.ok) throw new Error(`Failed to load comments (${res.status}).`);
    return (await res.json()) as BlogComment[];
  }

  async submitComment(input: BlogCommentInput): Promise<BlogCommentResult> {
    try {
      const res = await fetch(`${apiBase()}/api/public/blog-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as BlogCommentResult;
      return body;
    } catch {
      return { ok: false, reason: "Your comment could not be submitted. Please try again." };
    }
  }
}

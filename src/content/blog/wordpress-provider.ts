import { createServerOnlyFn } from "@tanstack/react-start";
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
 * createServerOnlyFn keeps the actual WordPress fetch/parse/cache logic
 * (src/server/wordpress-blog.ts) out of the client bundle: the build
 * strips the function body from the client output entirely, and calling it
 * client-side throws instead of silently doing the wrong thing.
 *
 * That's the right fit for the read paths below, which only ever run from
 * a route loader (SSR or a client-side navigation that re-runs the same
 * loader code, which TanStack Start still executes server-side via this
 * mechanism). Comment *submission* is different — it only ever happens
 * from a browser form handler — so it goes through the real
 * /api/public/blog-comments endpoint instead; see that route file.
 */
const getBlogList = createServerOnlyFn(async (params?: BlogListParams): Promise<BlogListResult> => {
  const { fetchBlogList } = await import("@/server/wordpress-blog");
  return fetchBlogList(params);
});

const getBlogArticleBySlug = createServerOnlyFn(async (slug: string): Promise<BlogArticle | undefined> => {
  const { fetchBlogArticleBySlug } = await import("@/server/wordpress-blog");
  return fetchBlogArticleBySlug(slug);
});

const getComments = createServerOnlyFn(async (articleId: string): Promise<BlogComment[]> => {
  const { fetchComments } = await import("@/server/wordpress-blog");
  return fetchComments(articleId);
});

export class WordPressBlogDataProvider implements BlogDataProvider {
  async listArticles(params?: BlogListParams): Promise<BlogListResult> {
    return getBlogList(params);
  }

  async getArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
    return getBlogArticleBySlug(slug);
  }

  async listComments(articleId: string): Promise<BlogComment[]> {
    return getComments(articleId);
  }

  async submitComment(input: BlogCommentInput): Promise<BlogCommentResult> {
    try {
      const res = await fetch("/api/public/blog-comments", {
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

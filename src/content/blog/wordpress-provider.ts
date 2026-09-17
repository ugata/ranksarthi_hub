import { createServerOnlyFn } from "@tanstack/react-start";
import type { BlogArticle, BlogDataProvider } from "./types";

/**
 * createServerOnlyFn keeps the actual WordPress fetch/parse/cache logic
 * (src/server/wordpress-blog.ts) out of the client bundle: the build
 * strips the function body from the client output entirely, and calling it
 * client-side throws instead of silently doing the wrong thing.
 */
const getBlogList = createServerOnlyFn(async (): Promise<BlogArticle[]> => {
  const { fetchBlogList } = await import("@/server/wordpress-blog");
  return fetchBlogList();
});

const getBlogArticleBySlug = createServerOnlyFn(async (slug: string): Promise<BlogArticle | undefined> => {
  const { fetchBlogArticleBySlug } = await import("@/server/wordpress-blog");
  return fetchBlogArticleBySlug(slug);
});

export class WordPressBlogDataProvider implements BlogDataProvider {
  async listArticles(): Promise<BlogArticle[]> {
    return getBlogList();
  }

  async getArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
    return getBlogArticleBySlug(slug);
  }
}

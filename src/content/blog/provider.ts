import type { BlogArticle, BlogDataProvider } from "./types";
import { WordPressBlogDataProvider } from "./wordpress-provider";

export class LocalBlogDataProvider implements BlogDataProvider {
  async listArticles(): Promise<BlogArticle[]> {
    if (!import.meta.env.DEV) return [];
    const { localBlogArticles } = await import("./local-data");
    return localBlogArticles;
  }

  async getArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
    if (!import.meta.env.DEV) return undefined;
    const { localBlogArticles } = await import("./local-data");
    return localBlogArticles.find((article) => article.slug === slug);
  }
}

export class EmptyBlogDataProvider implements BlogDataProvider {
  async listArticles(): Promise<BlogArticle[]> {
    return [];
  }

  async getArticleBySlug(): Promise<BlogArticle | undefined> {
    return undefined;
  }
}

/**
 * DEV uses the local sample articles. Production uses WordPress once it's
 * connected (see src/server/wordpress-blog.ts); until WP_CMS_ORIGIN is set,
 * WordPressBlogDataProvider's underlying fetch simply returns nothing, which
 * degrades to the same "empty editorial hub" state EmptyBlogDataProvider
 * used to provide explicitly.
 */
export function selectBlogDataProvider(isDevelopment: boolean): BlogDataProvider {
  return isDevelopment ? new LocalBlogDataProvider() : new WordPressBlogDataProvider();
}

export const blogDataProvider: BlogDataProvider = selectBlogDataProvider(import.meta.env.DEV);
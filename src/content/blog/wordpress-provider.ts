import { createServerFn } from "@tanstack/react-start";
import type { BlogArticle, BlogDataProvider } from "./types";

/**
 * createServerFn keeps the actual WordPress fetch/parse/cache logic
 * (src/server/wordpress-blog.ts) out of the client bundle entirely: the
 * client gets a thin RPC stub, the handler body only ever runs server-side,
 * whether this is called during SSR or a client-side navigation.
 */
const getBlogList = createServerFn({ method: "GET" }).handler(async (): Promise<BlogArticle[]> => {
  const { fetchBlogList } = await import("@/server/wordpress-blog");
  return fetchBlogList();
});

const getBlogArticle = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<BlogArticle | undefined> => {
    const { fetchBlogArticleBySlug } = await import("@/server/wordpress-blog");
    return fetchBlogArticleBySlug(slug);
  });

export class WordPressBlogDataProvider implements BlogDataProvider {
  async listArticles(): Promise<BlogArticle[]> {
    return getBlogList();
  }

  async getArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
    return getBlogArticle({ data: slug });
  }
}

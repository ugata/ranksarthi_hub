import { createFileRoute } from "@tanstack/react-router";
import { BlogHome } from "@/components/blog/BlogHome";
import { PageFrame } from "@/components/shell/PageFrame";
import { blogDataProvider } from "@/content/blog";
import type { BlogCategory } from "@/content/blog";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";
import { buildHead } from "@/lib/seo";

const title = "Learning & Exam Insights | Rank Sarthi";
const description = "Practical guidance, official exam updates and useful preparation insights for JEE, NEET and NDA aspirants.";

const CATEGORIES: BlogCategory[] = ["JEE", "NEET", "NDA", "Exam Updates", "Preparation Strategy", "Study Resources"];

interface BlogSearch {
  page: number;
  category?: BlogCategory;
  tag?: string;
}

export const Route = createFileRoute("/blog/")({
  validateSearch: (search: Record<string, unknown>): BlogSearch => {
    const page = Number(search["page"]);
    const category = CATEGORIES.find((c) => c === search["category"]);
    const tag = typeof search["tag"] === "string" && search["tag"] ? search["tag"] : undefined;
    return {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      ...(category ? { category } : {}),
      ...(tag ? { tag } : {}),
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => blogDataProvider.listArticles(deps),
  head: ({ loaderData }) =>
    buildHead({
      url: "/blog",
      title,
      description,
      ogTitle: "Rank Sarthi Learning & Exam Insights",
      ogDescription: description,
      ogType: "website",
      jsonLd: [
        collectionPageSchema({
          url: "/blog",
          name: "Rank Sarthi Learning & Exam Insights",
          description,
          items: (loaderData?.items ?? []).map((article) => ({ name: article.title, url: `/blog/${article.slug}` })),
        }),
        breadcrumbSchema("/blog"),
      ],
    }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { items, pagination } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <PageFrame frame="F1" url="/blog">
      <BlogHome articles={items} pagination={pagination} activeCategory={search.category} activeTag={search.tag} />
    </PageFrame>
  );
}

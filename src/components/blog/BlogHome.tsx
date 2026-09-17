import { Link } from "@tanstack/react-router";
import { BlogCard } from "./BlogCard";
import { Button } from "@/components/ui/button";
import type { BlogArticle, BlogCategory, BlogPagination } from "@/content/blog";

const CATEGORIES: BlogCategory[] = ["JEE", "NEET", "NDA", "Exam Updates", "Preparation Strategy", "Study Resources"];

function ArticleGrid({ articles }: { articles: BlogArticle[] }) {
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{articles.map((article) => <BlogCard key={article.id} article={article} />)}</div>;
}

function CategoryFilters({ active }: { active: BlogCategory | undefined }) {
  return (
    <div className="mt-8 overflow-x-auto pb-2" role="group" aria-label="Filter articles by category">
      <div className="flex min-w-max gap-2 md:min-w-0 md:flex-wrap">
        <Button asChild type="button" size="sm" variant={!active ? "default" : "outline"} aria-pressed={!active}>
          <Link to="/blog" search={{ page: 1 }}>All</Link>
        </Button>
        {CATEGORIES.map((item) => (
          <Button key={item} asChild type="button" size="sm" variant={active === item ? "default" : "outline"} aria-pressed={active === item}>
            <Link to="/blog" search={{ page: 1, category: item }}>{item}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function PaginationBar({
  pagination,
  category,
  tag,
}: {
  pagination: BlogPagination;
  category: BlogCategory | undefined;
  tag: string | undefined;
}) {
  if (pagination.totalPages <= 1) return null;
  const searchFor = (page: number) => ({ page, ...(category ? { category } : {}), ...(tag ? { tag } : {}) });
  return (
    <nav aria-label="Blog pagination" className="mt-12 flex items-center justify-center gap-3">
      <Button asChild variant="outline" size="sm" disabled={pagination.page <= 1}>
        <Link to="/blog" search={searchFor(Math.max(1, pagination.page - 1))} aria-disabled={pagination.page <= 1}>
          Previous
        </Link>
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <Button asChild variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}>
        <Link
          to="/blog"
          search={searchFor(Math.min(pagination.totalPages, pagination.page + 1))}
          aria-disabled={pagination.page >= pagination.totalPages}
        >
          Next
        </Link>
      </Button>
    </nav>
  );
}

export function BlogHome({
  articles,
  pagination,
  activeCategory,
  activeTag,
}: {
  articles: BlogArticle[];
  pagination: BlogPagination;
  activeCategory: BlogCategory | undefined;
  activeTag: string | undefined;
}) {
  const isFirstPage = pagination.page === 1 && !activeTag;
  const featured = isFirstPage ? articles.find((a) => a.featured) ?? articles[0] : undefined;
  const rest = featured ? articles.filter((a) => a.id !== featured.id) : articles;

  return (
    <>
      <div className="border-b border-border bg-ivory pt-20 md:pt-24">
        <div className="container-page py-4"><nav aria-label="Breadcrumb"><ol className="flex items-center gap-2 text-sm text-muted-foreground"><li><Link to="/" className="hover:text-accent">Home</Link></li><li aria-hidden>/</li><li className="font-medium text-primary" aria-current="page">Blog</li></ol></nav></div>
      </div>
      <div className="container-page py-10 md:py-14">
        <header className="max-w-4xl">
          <p className="eyebrow text-accent">Rank Sarthi editorial</p>
          <h1 className="mt-3 text-display-lg text-primary">Rank Sarthi Learning &amp; Exam Insights</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Practical guidance, official exam updates and useful preparation insights for JEE, NEET and NDA aspirants.</p>
        </header>

        {!articles.length && pagination.totalItems === 0 ? (
          <section className="mt-10 rounded-xl border border-border bg-ivory p-8 text-center">
            <h2 className="text-xl font-bold text-primary">Articles coming from the editorial team</h2>
            <p className="mt-2 text-muted-foreground">Rank Sarthi articles will appear here when they are ready.</p>
          </section>
        ) : (
          <>
            <CategoryFilters active={activeCategory} />

            {activeTag ? (
              <p className="mt-6 text-sm text-muted-foreground">
                Showing articles tagged <span className="font-semibold text-primary">{activeTag}</span> ·{" "}
                <Link to="/blog" search={{ page: 1 }} className="text-accent underline underline-offset-4">Clear</Link>
              </p>
            ) : null}

            {featured ? (
              <section className="mt-12">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Featured article</p>
                <BlogCard article={featured} featured />
              </section>
            ) : null}

            <section className="mt-16">
              <h2 className="text-display-md text-primary">{isFirstPage ? "Latest articles" : "Articles"}</h2>
              {rest.length ? (
                <div className="mt-6"><ArticleGrid articles={rest} /></div>
              ) : (
                <p className="mt-4 text-muted-foreground">No articles match this filter yet.</p>
              )}
            </section>

            <PaginationBar pagination={pagination} category={activeCategory} tag={activeTag} />
          </>
        )}
      </div>

      <section className="bg-navy-deep text-primary-foreground"><div className="container-page py-12 text-center md:py-16"><h2 className="text-2xl font-bold">Preparing for an exam?</h2><div className="mt-6 flex flex-wrap justify-center gap-3">{(["jee", "neet", "nda"] as const).map((exam) => <Button key={exam} asChild variant="secondary"><Link to="/$platform" params={{ platform: exam }}>{exam.toUpperCase()}</Link></Button>)}</div></div></section>
    </>
  );
}

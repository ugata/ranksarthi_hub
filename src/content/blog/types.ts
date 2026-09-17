export type BlogExam = "JEE" | "NEET" | "NDA" | "GENERAL";

export type BlogCategory =
  | "JEE"
  | "NEET"
  | "NDA"
  | "Exam Updates"
  | "Preparation Strategy"
  | "Study Resources";

/** Safe, curated formatting an editor can apply from the WordPress block editor. */
export interface BlogInlineStyle {
  color?: string;
  backgroundColor?: string;
}

export interface BlogInline extends BlogInlineStyle {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export type BlogAlign = "left" | "center" | "right";

export type BlogContentNode =
  | { type: "heading"; level: 2 | 3; id: string; text: string; align?: BlogAlign }
  | { type: "paragraph"; children: BlogInline[]; align?: BlogAlign }
  | { type: "list"; ordered?: boolean; items: BlogInline[][] }
  | { type: "blockquote"; children: BlogInline[] }
  | { type: "table"; caption?: string; columns: string[]; rows: string[][] }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "callout"; title?: string; tone?: "info" | "caution"; children: BlogInline[] };

export interface BlogPerson {
  name: string;
  role?: string;
  verified: true;
}

export interface BlogSource {
  name: string;
  sourceType: "official" | "official-pdf" | "first-party" | "textbook" | "news";
  url: string;
  official: boolean;
}

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: BlogContentNode[];
  keyTakeaways?: BlogInline[][];
  featuredImage: string;
  featuredImageAlt: string;
  primaryExam: BlogExam;
  category: BlogCategory;
  /** Child category under `category`, when the CMS category has a parent. */
  subCategory?: string;
  tags: string[];
  publishedAt?: string;
  updatedAt?: string;
  author: BlogPerson | null;
  reviewer: BlogPerson | null;
  reviewStatus: "UNASSIGNED" | "REVIEW_PENDING" | "REVIEWED";
  sources: BlogSource[];
  relatedArticleSlugs: string[];
  relatedInternalRoutes: string[];
  seoTitle: string;
  metaDescription: string;
  /** Comma-separated meta keywords, when the CMS provides them explicitly. */
  keywords?: string;
  canonicalOverride: string | null;
  featured: boolean;
  status: "draft" | "published";
}

export interface BlogPagination {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface BlogListResult {
  items: BlogArticle[];
  pagination: BlogPagination;
}

export interface BlogListParams {
  page?: number;
  perPage?: number;
  category?: BlogCategory;
  tag?: string;
}

export interface BlogDataProvider {
  listArticles(params?: BlogListParams): Promise<BlogListResult>;
  getArticleBySlug(slug: string): Promise<BlogArticle | undefined>;
}

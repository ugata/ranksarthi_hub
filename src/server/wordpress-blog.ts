import "server-only";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { getUrl } from "@/content/registry";
import type {
  BlogArticle,
  BlogCategory,
  BlogContentNode,
  BlogExam,
  BlogInline,
  BlogSource,
} from "@/content/blog/types";

/**
 * Headless WordPress adapter — implements the contract documented in
 * Rank_Sarthi_WordPress_API_Contract.md / _Blog_Field_Mapping.md.
 *
 * Server-only: does the network fetch, HTML→block parsing and in-memory
 * caching, so no visitor's browser ever talks to WordPress directly and the
 * heavier parsing code never ships in the client bundle.
 */

const CMS_ORIGIN = (process.env["WP_CMS_ORIGIN"] ?? "").replace(/\/+$/, "");
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const PLACEHOLDER_IMAGE = "/brand/rank-sarthi-logo.png";

const CATEGORY_MAP: Record<string, BlogCategory> = {
  jee: "JEE",
  neet: "NEET",
  nda: "NDA",
  "exam updates": "Exam Updates",
  "preparation strategy": "Preparation Strategy",
  "study resources": "Study Resources",
};

function mapCategory(names: string[]): BlogCategory {
  for (const name of names) {
    const mapped = CATEGORY_MAP[name.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return "Study Resources";
}

function mapExam(value: string | undefined): BlogExam {
  const v = (value ?? "").trim().toUpperCase();
  return v === "JEE" || v === "NEET" || v === "NDA" ? v : "GENERAL";
}

function decodeText(html: string): string {
  if (!html) return "";
  return cheerio.load(`<div>${html}</div>`)("div").text().trim();
}

/** Safe protocols only; anything else is rendered as plain text, never a link. */
function isSafeHref(href: string): boolean {
  return href.startsWith("/") || /^https?:|^mailto:|^tel:/i.test(href);
}

function parseInline($: cheerio.CheerioAPI, node: AnyNode): BlogInline[] {
  const out: BlogInline[] = [];
  const walk = (el: AnyNode, bold: boolean, italic: boolean, href?: string) => {
    if (el.type === "text") {
      const text = (el as unknown as { data: string }).data;
      if (text) out.push({ text, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}), ...(href ? { href } : {}) });
      return;
    }
    if (el.type !== "tag") return;
    const tag = el.name.toLowerCase();
    const nextBold = bold || tag === "strong" || tag === "b";
    const nextItalic = italic || tag === "em" || tag === "i";
    let nextHref = href;
    if (tag === "a") {
      const raw = $(el).attr("href") ?? "";
      if (isSafeHref(raw)) nextHref = raw;
    }
    if (tag === "br") {
      out.push({ text: " " });
      return;
    }
    for (const child of (el as unknown as { children: AnyNode[] }).children ?? []) {
      walk(child, nextBold, nextItalic, nextHref);
    }
  };
  for (const child of (node as unknown as { children: AnyNode[] }).children ?? []) {
    walk(child, false, false, undefined);
  }
  return out.filter((n) => n.text.trim().length > 0 || n.href);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Maps sanitised WordPress body HTML into the supported block allow-list. */
function parseContent(html: string): BlogContentNode[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const root = $.root().get(0);
  if (!root) return [];
  const nodes: BlogContentNode[] = [];
  const seenIds = new Set<string>();

  const uniqueId = (text: string) => {
    let id = slugify(text) || "section";
    let n = 2;
    while (seenIds.has(id)) id = `${slugify(text)}-${n++}`;
    seenIds.add(id);
    return id;
  };

  $(root)
    .children()
    .each((_, el) => {
      const $el = $(el);
      const tag = el.type === "tag" ? el.name.toLowerCase() : "";

      if (tag === "h2" || tag === "h3") {
        const text = $el.text().trim();
        if (!text) return;
        nodes.push({ type: "heading", level: tag === "h2" ? 2 : 3, id: uniqueId(text), text });
        return;
      }
      if (tag === "p") {
        const children = parseInline($, el);
        if (children.length) nodes.push({ type: "paragraph", children });
        return;
      }
      if (tag === "ul" || tag === "ol") {
        const items = $el
          .children("li")
          .toArray()
          .map((li) => parseInline($, li))
          .filter((item) => item.length > 0);
        if (items.length) nodes.push({ type: "list", ordered: tag === "ol", items });
        return;
      }
      if (tag === "blockquote") {
        const text = $el.clone().find("p").first();
        const children = text.length ? parseInline($, text.get(0)!) : parseInline($, el);
        if (children.length) nodes.push({ type: "blockquote", children });
        return;
      }
      if (tag === "table") {
        const columns = $el
          .find("thead th, tr:first-child th")
          .toArray()
          .map((th) => $(th).text().trim());
        const rows = $el
          .find("tbody tr, tr")
          .toArray()
          .filter((tr) => $(tr).find("th").length === 0)
          .map((tr) => $(tr).find("td").toArray().map((td) => $(td).text().trim()));
        const caption = $el.find("caption").first().text().trim() || undefined;
        if (columns.length && rows.length) nodes.push({ type: "table", ...(caption ? { caption } : {}), columns, rows });
        return;
      }
      if (tag === "figure") {
        const img = $el.find("img").first();
        if (img.length) {
          const src = img.attr("src") ?? "";
          const alt = img.attr("alt") ?? "";
          const caption = $el.find("figcaption").first().text().trim() || undefined;
          if (src && alt) nodes.push({ type: "image", src, alt, ...(caption ? { caption } : {}) });
        }
        return;
      }
      if (tag === "img") {
        const src = $el.attr("src") ?? "";
        const alt = $el.attr("alt") ?? "";
        if (src && alt) nodes.push({ type: "image", src, alt });
        return;
      }
      // Anything else (script, iframe, form, style, embeds, raw divs) is dropped.
    });

  return nodes;
}

interface WpTerm {
  id: number;
  name: string;
  taxonomy: string;
}

interface WpPost {
  id: number;
  slug: string;
  status: string;
  date_gmt: string;
  modified_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  meta?: Record<string, unknown>;
  _embedded?: {
    "wp:featuredmedia"?: { source_url: string; alt_text?: string }[];
    "wp:term"?: WpTerm[][];
    author?: { name: string }[];
  };
  yoast_head_json?: {
    title?: string;
    description?: string;
    og_image?: { url: string }[];
    canonical?: string;
  };
}

function toIso(gmtDate: string | undefined): string | undefined {
  if (!gmtDate) return undefined;
  const iso = gmtDate.endsWith("Z") ? gmtDate : `${gmtDate}Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

function readMeta(post: WpPost, key: string): unknown {
  return post.meta?.[key];
}

function readStringArrayMeta(post: WpPost, key: string): string[] {
  const value = readMeta(post, key);
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim()) return value.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

function readSourcesMeta(post: WpPost): BlogSource[] {
  const value = readMeta(post, "sources");
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["official", "official-pdf", "first-party", "textbook", "news"]);
  return value
    .filter(
      (v): v is { name: string; sourceType: string; url: string; official: boolean } =>
        !!v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string",
    )
    .filter((v) => allowed.has(v.sourceType) && /^https:\/\//i.test(v.url))
    .map((v) => ({ name: v.name, sourceType: v.sourceType as BlogSource["sourceType"], url: v.url, official: !!v.official }));
}

function normalisePost(post: WpPost): BlogArticle {
  const terms = (post._embedded?.["wp:term"] ?? []).flat();
  const categories = terms.filter((t) => t.taxonomy === "category").map((t) => t.name);
  const tags = terms.filter((t) => t.taxonomy === "post_tag").map((t) => t.name);
  const examTerm = terms.find((t) => t.taxonomy === "primary_exam")?.name;

  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const hasImage = !!media?.source_url && !!media?.alt_text;

  const title = decodeText(post.title.rendered);
  const excerptSource = decodeText(post.excerpt.rendered);
  const publishedAt = toIso(post.date_gmt);
  const updatedAt = toIso(post.modified_gmt);
  const relatedInternalRoutes = readStringArrayMeta(post, "related_internal_routes").filter(
    (url) => getUrl(url)?.buildStatus === "built",
  );

  const yoast = post.yoast_head_json;
  const keywords = readStringArrayMeta(post, "meta_keywords").join(", ") || undefined;

  return {
    id: String(post.id),
    slug: post.slug,
    title,
    excerpt: excerptSource || title,
    content: parseContent(post.content.rendered),
    featuredImage: hasImage ? media!.source_url : PLACEHOLDER_IMAGE,
    featuredImageAlt: hasImage ? media!.alt_text! : "Rank Sarthi",
    primaryExam: mapExam(examTerm),
    category: mapCategory(categories),
    tags,
    ...(publishedAt ? { publishedAt } : {}),
    ...(updatedAt && updatedAt !== publishedAt ? { updatedAt } : {}),
    author: null,
    reviewer: null,
    reviewStatus: (() => {
      const v = readMeta(post, "review_status");
      return v === "REVIEW_PENDING" || v === "REVIEWED" ? v : "UNASSIGNED";
    })(),
    sources: readSourcesMeta(post),
    relatedArticleSlugs: readStringArrayMeta(post, "related_article_slugs"),
    relatedInternalRoutes,
    seoTitle: yoast?.title || `${title} | Rank Sarthi`,
    metaDescription: yoast?.description || excerptSource || title,
    ...(keywords ? { keywords } : {}),
    canonicalOverride: `https://ranksarthi.com/blog/${post.slug}`,
    featured: readMeta(post, "featured") === true,
    status: post.status === "publish" ? "published" : "draft",
  };
}

async function wpFetch(path: string): Promise<unknown> {
  if (!CMS_ORIGIN) return null;
  const res = await fetch(`${CMS_ORIGIN}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`WordPress request failed: ${res.status} ${path}`);
  return res.json();
}

let listCache: { data: BlogArticle[]; expires: number } | null = null;
let listInFlight: Promise<BlogArticle[]> | null = null;
const articleCache = new Map<string, { data: BlogArticle | undefined; expires: number }>();

export async function fetchBlogList(): Promise<BlogArticle[]> {
  const now = Date.now();
  if (listCache && listCache.expires > now) return listCache.data;
  if (listInFlight) return listInFlight;

  listInFlight = (async () => {
    try {
      const raw = await wpFetch("/wp-json/wp/v2/posts?status=publish&per_page=100&_embed=1");
      const posts = Array.isArray(raw) ? (raw as WpPost[]) : [];
      const data = posts.map(normalisePost);
      listCache = { data, expires: Date.now() + CACHE_TTL_MS };
      return data;
    } catch (error) {
      console.error("[wordpress-blog] list fetch failed:", error);
      // Serve stale data rather than an empty hub if we have any.
      return listCache?.data ?? [];
    } finally {
      listInFlight = null;
    }
  })();
  return listInFlight;
}

export async function fetchBlogArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
  const now = Date.now();
  const cached = articleCache.get(slug);
  if (cached && cached.expires > now) return cached.data;

  try {
    const raw = await wpFetch(`/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=publish&_embed=1`);
    const posts = Array.isArray(raw) ? (raw as WpPost[]) : [];
    if (posts.length !== 1) {
      articleCache.set(slug, { data: undefined, expires: now + CACHE_TTL_MS });
      return undefined;
    }
    const data = normalisePost(posts[0]!);
    articleCache.set(slug, { data, expires: now + CACHE_TTL_MS });
    return data;
  } catch (error) {
    console.error(`[wordpress-blog] article fetch failed for "${slug}":`, error);
    return cached?.data;
  }
}

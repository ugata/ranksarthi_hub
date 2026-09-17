import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { getUrl } from "@/content/registry";
import type {
  BlogAlign,
  BlogArticle,
  BlogCategory,
  BlogContentNode,
  BlogExam,
  BlogInline,
  BlogInlineStyle,
  BlogListParams,
  BlogListResult,
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
const TAXONOMY_CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_PER_PAGE = 12;
const PLACEHOLDER_IMAGE = "/brand/rank-sarthi-logo.png";

const CATEGORY_MAP: Record<string, BlogCategory> = {
  jee: "JEE",
  neet: "NEET",
  nda: "NDA",
  "exam updates": "Exam Updates",
  "preparation strategy": "Preparation Strategy",
  "study resources": "Study Resources",
};

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

/** Allow-lists a curated set of CSS colour formats; rejects anything else (url(), expressions, breakouts). */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z-]+)$/i;
function safeColor(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v && SAFE_COLOR.test(v) ? v : undefined;
}

/** Reads editor-applied colour/background from a style attribute, allow-list only. */
function styleFromAttr(style: string | undefined): BlogInlineStyle {
  if (!style) return {};
  const out: BlogInlineStyle = {};
  for (const decl of style.split(";")) {
    const [prop, ...rest] = decl.split(":");
    const value = rest.join(":").trim();
    if (!prop || !value) continue;
    const name = prop.trim().toLowerCase();
    if (name === "color") {
      const c = safeColor(value);
      if (c) out.color = c;
    } else if (name === "background-color") {
      const c = safeColor(value);
      if (c) out.backgroundColor = c;
    }
  }
  return out;
}

/** WordPress's block editor marks alignment via has-text-align-* classes or inline style. */
function alignFromEl($: cheerio.CheerioAPI, el: AnyNode): BlogAlign | undefined {
  const cls = $(el).attr("class") ?? "";
  if (/has-text-align-center/.test(cls)) return "center";
  if (/has-text-align-right/.test(cls)) return "right";
  if (/has-text-align-left/.test(cls)) return "left";
  const style = $(el).attr("style") ?? "";
  const m = /text-align\s*:\s*(left|center|right)/i.exec(style);
  return m ? (m[1]!.toLowerCase() as BlogAlign) : undefined;
}

function parseInline($: cheerio.CheerioAPI, node: AnyNode): BlogInline[] {
  const out: BlogInline[] = [];
  const walk = (el: AnyNode, bold: boolean, italic: boolean, href: string | undefined, style: BlogInlineStyle) => {
    if (el.type === "text") {
      const text = (el as unknown as { data: string }).data;
      if (text) {
        out.push({
          text,
          ...(bold ? { bold: true } : {}),
          ...(italic ? { italic: true } : {}),
          ...(href ? { href } : {}),
          ...style,
        });
      }
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
    const elStyle = styleFromAttr($(el).attr("style"));
    const nextStyle: BlogInlineStyle = { ...style, ...elStyle };
    if (tag === "br") {
      out.push({ text: " " });
      return;
    }
    for (const child of (el as unknown as { children: AnyNode[] }).children ?? []) {
      walk(child, nextBold, nextItalic, nextHref, nextStyle);
    }
  };
  for (const child of (node as unknown as { children: AnyNode[] }).children ?? []) {
    walk(child, false, false, undefined, {});
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
  // cheerio.load() wraps a fragment in an implicit <html><body>, so the
  // actual content lives one level below root.
  const root = $("body").get(0);
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
      const align = alignFromEl($, el);

      if (tag === "h2" || tag === "h3") {
        const text = $el.text().trim();
        if (!text) return;
        nodes.push({ type: "heading", level: tag === "h2" ? 2 : 3, id: uniqueId(text), text, ...(align ? { align } : {}) });
        return;
      }
      if (tag === "p") {
        const children = parseInline($, el);
        if (children.length) nodes.push({ type: "paragraph", children, ...(align ? { align } : {}) });
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
      // Anything else (script, iframe, form, embeds, raw divs) is dropped.
      // A `style` *attribute* on allow-listed tags is read above; a literal
      // <style> tag or inline event handler never reaches here.
    });

  return nodes;
}

interface WpTerm {
  id: number;
  name: string;
  taxonomy: string;
}

interface WpCategory {
  id: number;
  name: string;
  parent: number;
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

/** Resolves the frontend category plus an optional child category name from WP's category hierarchy. */
function resolveCategory(
  terms: WpTerm[],
  hierarchy: Map<number, WpCategory>,
): { category: BlogCategory; subCategory?: string } {
  const categoryTerms = terms.filter((t) => t.taxonomy === "category");
  for (const term of categoryTerms) {
    const node = hierarchy.get(term.id);
    if (node && node.parent) {
      const parent = hierarchy.get(node.parent);
      const mapped = parent ? CATEGORY_MAP[parent.name.trim().toLowerCase()] : undefined;
      if (mapped) return { category: mapped, subCategory: node.name };
    }
  }
  for (const term of categoryTerms) {
    const mapped = CATEGORY_MAP[term.name.trim().toLowerCase()];
    if (mapped) return { category: mapped };
  }
  return { category: "Study Resources" };
}

function normalisePost(post: WpPost, hierarchy: Map<number, WpCategory>): BlogArticle {
  const terms = (post._embedded?.["wp:term"] ?? []).flat();
  const tags = terms.filter((t) => t.taxonomy === "post_tag").map((t) => t.name);
  const examTerm = terms.find((t) => t.taxonomy === "primary_exam")?.name;
  const { category, subCategory } = resolveCategory(terms, hierarchy);

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
    category,
    ...(subCategory ? { subCategory } : {}),
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

async function wpFetch(path: string): Promise<{ data: unknown; headers: Headers } | null> {
  if (!CMS_ORIGIN) return null;
  const res = await fetch(`${CMS_ORIGIN}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`WordPress request failed: ${res.status} ${path}`);
  return { data: await res.json(), headers: res.headers };
}

let categoryHierarchy: { data: Map<number, WpCategory>; expires: number } | null = null;
let categoryHierarchyInFlight: Promise<Map<number, WpCategory>> | null = null;

async function getCategoryHierarchy(): Promise<Map<number, WpCategory>> {
  const now = Date.now();
  if (categoryHierarchy && categoryHierarchy.expires > now) return categoryHierarchy.data;
  if (categoryHierarchyInFlight) return categoryHierarchyInFlight;

  categoryHierarchyInFlight = (async () => {
    try {
      const result = await wpFetch("/wp-json/wp/v2/categories?per_page=100");
      const raw = Array.isArray(result?.data) ? (result.data as WpCategory[]) : [];
      const map = new Map(raw.map((c) => [c.id, c]));
      categoryHierarchy = { data: map, expires: Date.now() + TAXONOMY_CACHE_TTL_MS };
      return map;
    } catch (error) {
      console.error("[wordpress-blog] category hierarchy fetch failed:", error);
      return categoryHierarchy?.data ?? new Map();
    } finally {
      categoryHierarchyInFlight = null;
    }
  })();
  return categoryHierarchyInFlight;
}

/** category name -> WP category ids (a frontend category can map from >1 WP category, e.g. a parent + its children). */
async function categoryIdsFor(category: BlogCategory): Promise<number[]> {
  const hierarchy = await getCategoryHierarchy();
  const ids: number[] = [];
  for (const [id, node] of hierarchy) {
    const own = CATEGORY_MAP[node.name.trim().toLowerCase()];
    const parent = node.parent ? hierarchy.get(node.parent) : undefined;
    const viaParent = parent ? CATEGORY_MAP[parent.name.trim().toLowerCase()] : undefined;
    if (own === category || viaParent === category) ids.push(id);
  }
  return ids;
}

let tagIndex: { data: Map<string, number>; expires: number } | null = null;
let tagIndexInFlight: Promise<Map<string, number>> | null = null;

async function getTagIndex(): Promise<Map<string, number>> {
  const now = Date.now();
  if (tagIndex && tagIndex.expires > now) return tagIndex.data;
  if (tagIndexInFlight) return tagIndexInFlight;

  tagIndexInFlight = (async () => {
    try {
      const result = await wpFetch("/wp-json/wp/v2/tags?per_page=100");
      const raw = Array.isArray(result?.data) ? (result.data as { id: number; name: string }[]) : [];
      const map = new Map(raw.map((t) => [t.name.trim().toLowerCase(), t.id]));
      tagIndex = { data: map, expires: Date.now() + TAXONOMY_CACHE_TTL_MS };
      return map;
    } catch (error) {
      console.error("[wordpress-blog] tag index fetch failed:", error);
      return tagIndex?.data ?? new Map();
    } finally {
      tagIndexInFlight = null;
    }
  })();
  return tagIndexInFlight;
}

const listCache = new Map<string, { data: BlogListResult; expires: number }>();
const listInFlight = new Map<string, Promise<BlogListResult>>();
const articleCache = new Map<string, { data: BlogArticle | undefined; expires: number }>();

function cacheKey(params: BlogListParams): string {
  return JSON.stringify([params.page ?? 1, params.perPage ?? DEFAULT_PER_PAGE, params.category ?? "", params.tag ?? ""]);
}

export async function fetchBlogList(params: BlogListParams = {}): Promise<BlogListResult> {
  const key = cacheKey(params);
  const now = Date.now();
  const cached = listCache.get(key);
  if (cached && cached.expires > now) return cached.data;
  const inFlight = listInFlight.get(key);
  if (inFlight) return inFlight;

  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(50, Math.max(1, params.perPage ?? DEFAULT_PER_PAGE));

  const task = (async () => {
    try {
      const query = new URLSearchParams({
        status: "publish",
        page: String(page),
        per_page: String(perPage),
        _embed: "1",
      });
      if (params.category) {
        const ids = await categoryIdsFor(params.category);
        if (ids.length) query.set("categories", ids.join(","));
      }
      if (params.tag) {
        const tagId = (await getTagIndex()).get(params.tag.trim().toLowerCase());
        if (tagId) query.set("tags", String(tagId));
      }

      const result = await wpFetch(`/wp-json/wp/v2/posts?${query.toString()}`);
      const posts = result && Array.isArray(result.data) ? (result.data as WpPost[]) : [];
      const hierarchy = await getCategoryHierarchy();
      const items = posts.map((p) => normalisePost(p, hierarchy));

      const totalItems = Number(result?.headers.get("x-wp-total") ?? items.length);
      const totalPages = Number(result?.headers.get("x-wp-totalpages") ?? 1);
      const data: BlogListResult = { items, pagination: { page, perPage, totalItems, totalPages: totalPages || 1 } };
      listCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
      return data;
    } catch (error) {
      console.error("[wordpress-blog] list fetch failed:", error);
      return listCache.get(key)?.data ?? { items: [], pagination: { page, perPage, totalItems: 0, totalPages: 1 } };
    } finally {
      listInFlight.delete(key);
    }
  })();
  listInFlight.set(key, task);
  return task;
}

export async function fetchBlogArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
  const now = Date.now();
  const cached = articleCache.get(slug);
  if (cached && cached.expires > now) return cached.data;

  try {
    const result = await wpFetch(`/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=publish&_embed=1`);
    const posts = result && Array.isArray(result.data) ? (result.data as WpPost[]) : [];
    if (posts.length !== 1) {
      articleCache.set(slug, { data: undefined, expires: now + CACHE_TTL_MS });
      return undefined;
    }
    const hierarchy = await getCategoryHierarchy();
    const data = normalisePost(posts[0]!, hierarchy);
    articleCache.set(slug, { data, expires: now + CACHE_TTL_MS });
    return data;
  } catch (error) {
    console.error(`[wordpress-blog] article fetch failed for "${slug}":`, error);
    return cached?.data;
  }
}

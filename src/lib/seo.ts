import { absolute, getUrl, isIndexable } from "@/content/registry";
import { site } from "@/content/site";
import { breadcrumbSchema, infoPageSchema } from "@/lib/schema";
import type { InfoPageContent, PageMeta } from "@/content/types";

export interface HeadInput extends PageMeta {
  /** Registry path for this page. */
  url: string;
  jsonLd?: unknown[];
}

/**
 * Builds the per-route head() payload: unique title/description, canonical,
 * Open Graph, robots and JSON-LD. Robots follows the registry, so a page that
 * is renderable but not content-gate-approved emits noindex.
 */
export function buildHead(input: HeadInput) {
  const record = getUrl(input.url);
  const canonical = absolute(input.url);
  const ogTitle = input.ogTitle ?? input.title;
  const ogDescription = input.ogDescription ?? input.description;

  const meta: Array<Record<string, string>> = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: ogDescription },
    { property: "og:type", content: input.ogType ?? "website" },
    { property: "og:url", content: canonical },
    { property: "og:site_name", content: site.name },
    { property: "og:locale", content: site.locale },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: ogTitle },
    { name: "twitter:description", content: ogDescription },
  ];

  if (input.ogImage) {
    meta.push({ property: "og:image", content: input.ogImage });
    meta.push({ name: "twitter:image", content: input.ogImage });
  }

  if (record && !isIndexable(record)) {
    meta.push({ name: "robots", content: "noindex, follow" });
  }

  const scripts = (input.jsonLd ?? [])
    .filter(Boolean)
    .map((schema) => ({ type: "application/ld+json", children: JSON.stringify(schema) }));

  return {
    meta,
    links: [{ rel: "canonical", href: canonical }],
    ...(scripts.length ? { scripts } : {}),
  };
}

/** Shared head payload for a 404'd loader across every route. */
export const NOT_FOUND_HEAD = {
  meta: [{ title: "Not found | Rank Sarthi" }, { name: "robots", content: "noindex" }],
};

/**
 * Shared head + schema construction for every InfoPageContent-driven route
 * (T02/T04/T06/T12 info-page variants). Routes supply only what genuinely
 * differs between them: the description fallback chain and the OG type
 * default, both of which `content.seo` can still override.
 */
export function infoPageHead(
  content: InfoPageContent,
  options: { url?: string; description: string; ogType?: "website" | "article" },
) {
  const url = options.url ?? content.url;
  const title = content.seo?.title ?? `${content.title} | Rank Sarthi`;
  const description = content.seo?.description ?? options.description;

  return buildHead({
    url,
    title,
    description,
    ogType: content.seo?.ogType ?? options.ogType ?? "article",
    ...(content.seo?.ogTitle ? { ogTitle: content.seo.ogTitle } : {}),
    ...(content.seo?.ogDescription ? { ogDescription: content.seo.ogDescription } : {}),
    jsonLd: [
      infoPageSchema({
        url,
        title: content.title,
        description,
        blocks: content.blocks,
        ...(content.relatedLinks ? { relatedLinks: content.relatedLinks } : {}),
        ...(content.lastVerified ? { lastVerified: content.lastVerified } : {}),
      }),
      breadcrumbSchema(url),
    ],
  });
}

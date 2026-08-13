/**
 * JSON-LD generators (spec §3.10) — emitted as independent top-level blocks.
 *   - BlogPosting (full property set; keywords derived from primaryKeyword + tags)
 *   - BreadcrumbList (Home → Category → Post)
 *   - FAQPage (only when faqs exist — for readers/machine understanding, NOT
 *     Google rich results which were deprecated May 2026)
 *
 * Author/publisher come from siteConfig (single-author blog, no per-row author).
 */
import { siteConfig, absUrl } from "./siteConfig";

export type JsonLdPost = {
  slug: string;
  title: string; // H1
  seoTitle?: string | null;
  excerpt?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  featuredImagePath?: string | null;
  ogImagePath?: string | null;
  primaryKeyword?: string | null;
  tagNames?: string[];
  categoryName?: string | null;
  faqs?: { q: string; a: string }[] | null;
};

function img(p?: string | null): string | undefined {
  if (!p) return undefined;
  return p.startsWith("http") ? p : absUrl(p);
}

function iso(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  return new Date(d as string).toISOString();
}

export function blogPostingJsonLd(post: JsonLdPost) {
  const headline = post.title;
  const description = post.excerpt ?? undefined;
  const image = img(post.ogImagePath ?? post.featuredImagePath);
  const keywords = [post.primaryKeyword, ...(post.tagNames ?? [])]
    .filter(Boolean)
    .join(", ");
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    image: image ? [image] : undefined,
    datePublished: iso(post.publishedAt),
    dateModified: iso(post.updatedAt) ?? iso(post.publishedAt),
    author: {
      "@type": "Person",
      name: siteConfig.author.name,
      description: siteConfig.author.description,
      url: absUrl("/"),
      sameAs: siteConfig.author.sameAs,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: absUrl("/"),
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": absUrl(`/blog/${post.slug}`) },
    inLanguage: siteConfig.lang,
    articleSection: post.categoryName ?? undefined,
    keywords: keywords || undefined,
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.url),
    })),
  };
}

export function faqPageJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Build the full set of JSON-LD blocks for a post page. */
export function postJsonLdBlocks(post: JsonLdPost) {
  const blocks: object[] = [];
  blocks.push(blogPostingJsonLd(post));
  if (post.categoryName) {
    blocks.push(
      breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: post.categoryName, url: `/category/${post.categoryName}` },
        { name: post.title, url: `/blog/${post.slug}` },
      ]),
    );
  }
  if (post.faqs && post.faqs.length > 0) {
    blocks.push(faqPageJsonLd(post.faqs));
  }
  return blocks;
}

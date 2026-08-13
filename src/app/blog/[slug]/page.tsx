/**
 * Post page /blog/{slug} — editorial article layout (spec §3.8-3.11).
 *  - Derived metadata (seoTitle ?? title, excerpt, canonical, OG from featured)
 *  - Reading time + word count derived at render, never stored
 *  - JSON-LD: BlogPosting + BreadcrumbList + FAQPage (independent blocks)
 *  - TOC from headings, breadcrumbs, :::answer/:::faq AEO sections
 *  - Related cluster posts (pillar first) — internal linking
 *  - ISR hours fallback + on-demand revalidation on publish
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db/client";
import { posts } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import {
  getPostBySlug,
  getTagsForPost,
  getCategoryById,
  getClusterById,
} from "@/lib/articles/queries";
import { siteConfig, absUrl } from "@/lib/siteConfig";
import { MarkdownRenderer, extractToc, wordCount, readingTime } from "@/lib/markdown";
import { postJsonLdBlocks } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Toc } from "@/components/Toc";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const published = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(eq(posts.status, "published"));
  return published.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status !== "published") return {};

  const title = post.seoTitle ?? post.title;
  const ogImage = post.ogImagePath ?? post.featuredImagePath ?? undefined;
  const canonical = post.canonicalUrl ?? absUrl(`/blog/${post.slug}`);

  return {
    title,
    description: post.excerpt ?? undefined,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: absUrl(`/blog/${post.slug}`),
      title,
      description: post.excerpt ?? undefined,
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      modifiedTime: post.updatedAt.toISOString(),
      authors: [siteConfig.author.name],
      images: ogImage ? [{ url: ogImage.startsWith("http") ? ogImage : absUrl(ogImage) }] : undefined,
    },
    twitter: { card: "summary_large_image" },
    keywords: [post.primaryKeyword ?? "", ...(post.searchIntent ? [post.searchIntent] : [])].filter(Boolean),
  };
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status !== "published") notFound();

  const [tags, category, cluster] = await Promise.all([
    getTagsForPost(post.id),
    getCategoryById(post.categoryId),
    getClusterById(post.clusterId),
  ]);

  // Related cluster posts (pillar first), excluding current
  let related: typeof post[] = [];
  if (post.clusterId) {
    related = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.clusterId, post.clusterId),
          eq(posts.status, "published"),
          ne(posts.id, post.id),
        ),
      )
      .limit(6);
    related.sort((a, b) =>
      a.clusterRole === "pillar" ? -1 : b.clusterRole === "pillar" ? 1 : 0,
    );
  }

  const toc = extractToc(post.markdownBody);
  const minutes = Math.max(1, Math.round(wordCount(post.markdownBody) / 225));
  const hero = post.ogImagePath ?? post.featuredImagePath;
  const heroSrc = hero ? (hero.startsWith("http") ? hero : absUrl(hero)) : null;

  const jsonLd = postJsonLdBlocks({
    slug: post.slug,
    title: post.title,
    seoTitle: post.seoTitle,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    featuredImagePath: post.featuredImagePath,
    ogImagePath: post.ogImagePath,
    primaryKeyword: post.primaryKeyword,
    tagNames: tags.map((t) => t.name),
    categoryName: category?.name,
    faqs: post.faqs,
  });

  const crumbs = [
    { name: "Home", href: "/" },
    ...(category ? [{ name: category.name, href: `/category/${category.slug}` }] : []),
    { name: post.title, href: `/blog/${post.slug}` },
  ];

  return (
    <div className="container-prose py-8">
      <Breadcrumbs items={crumbs} />
      <JsonLd data={jsonLd} />

      {/* ───────── Article header (editorial) ───────── */}
      <header className="rise mx-auto mb-10 max-w-3xl text-center">
        {category && (
          <Link
            href={`/category/${category.slug}`}
            className="mb-4 inline-block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-accent transition-colors hover:underline"
          >
            {category.name}
          </Link>
        )}
        <h1 className="font-display text-balance text-3xl font-semibold leading-[1.12] tracking-tight md:text-[2.75rem]">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="font-display mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            {post.excerpt}
          </p>
        )}

        {/* Byline */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-sm text-ink-soft">
          <span className="font-medium text-foreground">{siteConfig.author.name}</span>
          {post.publishedAt && (
            <>
              <span aria-hidden>·</span>
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </time>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{readingTime(minutes)}</span>
        </div>
      </header>

      {/* Hero image */}
      {heroSrc && (
        <figure className="mb-10 overflow-hidden rounded-2xl border border-border bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroSrc}
            alt={post.featuredImageAlt ?? post.title}
            className="aspect-[16/9] w-full object-cover"
          />
        </figure>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mx-auto mb-10 flex max-w-3xl flex-wrap justify-center gap-2">
          {tags.map((t) => (
            <Link
              key={t.id}
              href={`/tag/${t.slug}`}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft transition-colors hover:border-accent/40 hover:text-accent"
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}

      {/* ───────── Body + TOC ───────── */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_16rem]">
        <article className="measure min-w-0 mx-auto w-full">
          <MarkdownRenderer content={post.markdownBody} />

          {/* Related in cluster */}
          {related.length > 0 && (
            <section className="mt-14 border-t border-border pt-8" data-section="related">
              <h2 className="font-display mb-4 text-xl font-semibold tracking-tight">
                {cluster ? `More in ${cluster.name}` : "Related guides"}
              </h2>
              <ul className="space-y-1">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/blog/${r.slug}`}
                      className="group flex items-baseline gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                    >
                      {r.clusterRole === "pillar" && (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white">
                          Pillar
                        </span>
                      )}
                      <span className="font-medium underline-offset-4 group-hover:text-accent group-hover:underline">
                        {r.title}
                      </span>
                      <span className="ml-auto text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <Toc items={toc} />
      </div>
    </div>
  );
}

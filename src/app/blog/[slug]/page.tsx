/**
 * Post page /blog/{slug} — the SEO/AEO centerpiece (spec §3.8-3.11).
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
      .limit(8);
    related.sort((a, b) =>
      a.clusterRole === "pillar" ? -1 : b.clusterRole === "pillar" ? 1 : 0,
    );
  }

  const toc = extractToc(post.markdownBody);
  const minutes = Math.max(1, Math.round(wordCount(post.markdownBody) / 225));
  const ogImage = post.ogImagePath ?? post.featuredImagePath;

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

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_18rem]">
        <article className="min-w-0 max-w-3xl">
          {/* Header */}
          <header className="mb-8">
            <h1 className="mb-3 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mb-4 text-lg text-gray-600 dark:text-gray-300">{post.excerpt}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              {post.publishedAt && (
                <time dateTime={new Date(post.publishedAt).toISOString()}>
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </time>
              )}
              <span>·</span>
              <span>{readingTime(minutes)}</span>
              {category && (
                <>
                  <span>·</span>
                  <Link href={`/category/${category.slug}`} className="hover:underline">
                    {category.name}
                  </Link>
                </>
              )}
            </div>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tag/${t.slug}`}
                    className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs text-gray-600 hover:underline dark:text-gray-400"
                  >
                    #{t.name}
                  </Link>
                ))}
              </div>
            )}
            {ogImage && (
              <img
                src={ogImage.startsWith("http") ? ogImage : absUrl(ogImage)}
                alt={post.featuredImageAlt ?? post.title}
                className="mt-6 aspect-video w-full rounded-xl border border-[var(--border)] object-cover"
              />
            )}
          </header>

          <MarkdownRenderer content={post.markdownBody} />

          {/* Related in cluster */}
          {related.length > 0 && (
            <section className="mt-12 border-t border-[var(--border)] pt-6" data-section="related">
              <h2 className="mb-3 text-lg font-semibold">
                {cluster ? `More in: ${cluster.name}` : "Related guides"}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/blog/${r.slug}`}
                      className="block rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-[var(--muted)]"
                    >
                      {r.clusterRole === "pillar" && (
                        <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-600">
                          Pillar
                        </span>
                      )}
                      <span className="font-medium">{r.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        {/* TOC sidebar */}
        <Toc items={toc} />
      </div>
    </div>
  );
}

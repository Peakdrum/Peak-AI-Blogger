/** /category/[slug] — all published posts in a category. */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db/client";
import { categories, posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { absUrl } from "@/lib/siteConfig";
import { PostCard } from "@/components/PostCard";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const rows = await db.select({ slug: categories.slug }).from(categories);
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await db.select().from(categories).where(eq(categories.slug, slug)).limit(1))[0];
  if (!cat) return {};
  return {
    title: cat.name,
    description: cat.description ?? `Guides in the ${cat.name} category.`,
    alternates: { canonical: absUrl(`/category/${cat.slug}`) },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  const cat = (await db.select().from(categories).where(eq(categories.slug, slug)).limit(1))[0];
  if (!cat) notFound();

  const catPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.categoryId, cat.id))
    .orderBy(posts.publishedAt);

  const published = catPosts.filter((p) => p.status === "published");

  return (
    <div className="container-narrow py-10">
      <header className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Category</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{cat.name}</h1>
        {cat.description && <p className="mt-2 text-gray-600 dark:text-gray-300">{cat.description}</p>}
      </header>
      {published.length === 0 ? (
        <p className="text-gray-500">No posts in this category yet.</p>
      ) : (
        <div className="grid gap-4">
          {published.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

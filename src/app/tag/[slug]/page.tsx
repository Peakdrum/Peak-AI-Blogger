/** /tag/[slug] — posts with a given tag. */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db/client";
import { tags, posts, postsTags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { absUrl } from "@/lib/siteConfig";
import { PostCard } from "@/components/PostCard";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const rows = await db.select({ slug: tags.slug }).from(tags);
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tag = (await db.select().from(tags).where(eq(tags.slug, slug)).limit(1))[0];
  if (!tag) return {};
  return {
    title: `#${tag.name}`,
    description: `Guides tagged “${tag.name}”.`,
    alternates: { canonical: absUrl(`/tag/${tag.slug}`) },
  };
}

export default async function TagPage({ params }: Params) {
  const { slug } = await params;
  const tag = (await db.select().from(tags).where(eq(tags.slug, slug)).limit(1))[0];
  if (!tag) notFound();

  const joins = await db
    .select({ postId: postsTags.postId })
    .from(postsTags)
    .where(eq(postsTags.tagId, tag.id));
  const ids = joins.map((j) => j.postId);

  let taggedPosts: typeof posts.$inferSelect[] = [];
  if (ids.length > 0) {
    const rows = await db.select().from(posts);
    taggedPosts = rows
      .filter((p) => ids.includes(p.id) && p.status === "published")
      .sort((a, b) => (b.publishedAt ?? 0).valueOf() - (a.publishedAt ?? 0).valueOf());
  }

  return (
    <div className="container-narrow py-10">
      <header className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Tag</p>
        <h1 className="text-3xl font-extrabold tracking-tight">#{tag.name}</h1>
      </header>
      {taggedPosts.length === 0 ? (
        <p className="text-gray-500">No posts with this tag yet.</p>
      ) : (
        <div className="grid gap-4">
          {taggedPosts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

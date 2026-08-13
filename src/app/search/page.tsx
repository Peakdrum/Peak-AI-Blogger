/** /search — server-side search over published posts (title/excerpt/body). */
import { db } from "@/db/client";
import { posts } from "@/db/schema";
import { ilike, or, eq, desc, and } from "drizzle-orm";
import { PostCard } from "@/components/PostCard";
import { absUrl } from "@/lib/siteConfig";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  alternates: { canonical: absUrl("/search") },
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let results: typeof posts.$inferSelect[] = [];
  if (query.length >= 2) {
    const like = `%${query}%`;
    results = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.status, "published"),
          or(ilike(posts.title, like), ilike(posts.excerpt, like), ilike(posts.markdownBody, like)),
        ),
      )
      .orderBy(desc(posts.publishedAt))
      .limit(30);
  }

  return (
    <div className="container-narrow py-10">
      <h1 className="mb-4 text-3xl font-extrabold tracking-tight">Search</h1>
      <form className="mb-6 flex gap-2" method="GET" action="/search">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search guides…"
          className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-400"
          autoFocus
        />
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900"
        >
          Search
        </button>
      </form>

      {query.length < 2 ? (
        <p className="text-gray-500">Type at least 2 characters to search.</p>
      ) : results.length === 0 ? (
        <p className="text-gray-500">No results for “{query}”.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">
            {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
          </p>
          <div className="grid gap-4">
            {results.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

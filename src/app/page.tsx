/**
 * Home page — recent published posts + niche pitch.
 * ISR with hours fallback (spec §3.9); on-demand revalidation on publish.
 */
import Link from "next/link";
import { listPosts } from "@/lib/articles/queries";
import { PostCard } from "@/components/PostCard";
import { siteConfig } from "@/lib/siteConfig";

export const revalidate = 3600;

export default async function HomePage() {
  const posts = await listPosts({ status: "published", limit: 6 });

  return (
    <div>
      <section className="border-b border-[var(--border)] bg-[var(--muted)]">
        <div className="container-prose py-16 text-center">
          <h1 className="font-display mb-4 text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            {siteConfig.name}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            {siteConfig.description}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/blog" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">
              Browse the blog
            </Link>
            <Link href="/categories" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]">
              Topics
            </Link>
          </div>
        </div>
      </section>

      <section className="container-prose py-12">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Latest guides</h2>
          <Link href="/blog" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            View all →
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-gray-500">
            <p className="mb-2 font-medium">No published posts yet.</p>
            <p className="text-sm">
              Publish your first article via the API to see it here. See the README for the
              <code className="mx-1 rounded bg-[var(--muted)] px-1">POST /api/articles</code> example.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

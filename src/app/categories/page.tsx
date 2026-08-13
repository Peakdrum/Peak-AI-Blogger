/** /categories — index of all categories (with post counts). */
import Link from "next/link";
import { db } from "@/db/client";
import { categories, posts } from "@/db/schema";
import type { Metadata } from "next";
import { absUrl } from "@/lib/siteConfig";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Categories",
  alternates: { canonical: absUrl("/categories") },
};

export default async function CategoriesPage() {
  const [cats, allPosts] = await Promise.all([
    db.select().from(categories).orderBy(categories.name),
    db.select({ categoryId: posts.categoryId, status: posts.status }).from(posts),
  ]);

  const counts = new Map<string, number>();
  for (const p of allPosts) {
    if (p.status !== "published" || !p.categoryId) continue;
    counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  }

  return (
    <div className="container-narrow py-10">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">Topics</h1>
      {cats.length === 0 ? (
        <p className="text-gray-500">No categories yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cats.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="block rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--muted)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{c.name}</h2>
                <span className="text-xs text-gray-500">{counts.get(c.id) ?? 0}</span>
              </div>
              {c.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

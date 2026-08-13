/** /blog — all published posts. */
import { listPosts } from "@/lib/articles/queries";
import { PostCard } from "@/components/PostCard";
import type { Metadata } from "next";
import { absUrl } from "@/lib/siteConfig";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog",
  description: "All published guides on local AI, Ollama, n8n, and private AI automation.",
  alternates: { canonical: absUrl("/blog") },
};

export default async function BlogIndex() {
  const posts = await listPosts({ status: "published", limit: 100 });
  return (
    <div className="container-narrow py-10">
      <h1 className="font-display mb-2 text-3xl font-semibold tracking-tight">All guides</h1>
      <p className="mb-8 text-ink-soft">Long-form guides on local AI, Ollama, n8n, and private automation.</p>
      {posts.length === 0 ? (
        <p className="text-gray-500">No published posts yet.</p>
      ) : (
        <div className="grid gap-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

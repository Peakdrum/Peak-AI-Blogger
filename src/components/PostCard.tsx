/** Post card for listings (home, blog index, category, cluster, tag, search). */
import Link from "next/link";
import { wordCount, readingTime } from "@/lib/markdown";

type PostCardData = {
  slug: string;
  title: string;
  excerpt?: string | null;
  markdownBody: string;
  publishedAt?: Date | string | null;
  primaryKeyword?: string | null;
};

export function PostCard({ post }: { post: PostCardData }) {
  const minutes = Math.max(1, Math.round(wordCount(post.markdownBody) / 225));
  const date = post.publishedAt
    ? new Date(post.publishedAt as string).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <article className="group rounded-xl border border-gray-200 p-5 transition hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:hover:border-gray-700">
      <h2 className="mb-2 text-xl font-semibold tracking-tight">
        <Link href={`/blog/${post.slug}`} className="hover:underline">
          {post.title}
        </Link>
      </h2>
      {post.excerpt && (
        <p className="mb-3 line-clamp-2 text-[0.95rem] leading-6 text-gray-600 dark:text-gray-400">
          {post.excerpt}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        {date && <time dateTime={new Date(post.publishedAt as string).toISOString()}>{date}</time>}
        <span>·</span>
        <span>{readingTime(minutes)}</span>
        {post.primaryKeyword && (
          <>
            <span>·</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.7rem] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {post.primaryKeyword}
            </span>
          </>
        )}
      </div>
    </article>
  );
}

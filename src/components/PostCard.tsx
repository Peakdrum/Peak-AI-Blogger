/** Post card for listings (home, blog index, category, cluster, tag, search).
 *  Editorial: serif title, accent eyebrow, optional thumbnail from featuredImagePath. */
import Link from "next/link";
import { wordCount, readingTime } from "@/lib/markdown";

type PostCardData = {
  slug: string;
  title: string;
  excerpt?: string | null;
  markdownBody: string;
  publishedAt?: Date | string | null;
  primaryKeyword?: string | null;
  featuredImagePath?: string | null;
  categoryName?: string | null;
  clusterRole?: "pillar" | "supporting" | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function PostCard({ post, compact = false }: { post: PostCardData; compact?: boolean }) {
  const minutes = Math.max(1, Math.round(wordCount(post.markdownBody) / 225));
  const date = post.publishedAt ? fmtDate(post.publishedAt as string) : null;
  const img = post.featuredImagePath || null;
  const imgSrc = img ? (img.startsWith("http") ? img : "") : "";

  return (
    <article className="group relative flex gap-5 rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
      {imgSrc && !compact && (
        <Link
          href={`/blog/${post.slug}`}
          className="relative hidden aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-xl bg-muted sm:block"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        {/* Eyebrow */}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em]">
          {post.clusterRole === "pillar" && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-white">Pillar</span>
          )}
          {post.categoryName && (
            <span className="text-accent">{post.categoryName}</span>
          )}
        </div>

        {/* Title */}
        <h2 className="font-display text-lg font-semibold leading-snug tracking-tight md:text-xl">
          <Link href={`/blog/${post.slug}`} className="transition-colors hover:text-accent">
            <span className="absolute inset-0" aria-hidden />
            {post.title}
          </Link>
        </h2>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-[0.92rem] leading-relaxed text-ink-soft">
            {post.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-soft">
          {date && <time dateTime={new Date(post.publishedAt as string).toISOString()}>{date}</time>}
          {date && <span aria-hidden>·</span>}
          <span>{readingTime(minutes)}</span>
          {post.primaryKeyword && (
            <>
              <span aria-hidden>·</span>
              <span className="font-mono text-[0.7rem]">{post.primaryKeyword}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

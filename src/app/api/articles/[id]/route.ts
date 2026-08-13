/**
 * GET   /api/articles/{id} — read one (drafts require auth)
 * PATCH /api/articles/{id} — partial update (draft-mode validation; slug
 *                             immutable once published; publishedAt preserved)
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { validateArticle } from "@/lib/articles/validate";
import { getPostById, setPostTags } from "@/lib/articles/queries";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const post = await getPostById(id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.status === "draft" && !isAuthorized(req)) return unauthorized();
  return NextResponse.json({ post });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return unauthorized();
  const { id } = await ctx.params;

  const existing = await getPostById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Slug immutability after publish (spec §3.5)
  if (existing.status === "published" && body.slug && body.slug !== existing.slug) {
    return NextResponse.json(
      {
        errors: [
          {
            field: "slug",
            code: "IMMUTABLE_AFTER_PUBLISH",
            message: "slug cannot be changed after a post is published.",
          },
        ],
      },
      { status: 422 },
    );
  }

  // PATCH is always partial → draft-mode validation
  const { errors, warnings, data } = validateArticle(body, "draft");
  if (errors.length > 0) return NextResponse.json({ errors }, { status: 422 });

  // Never mutate publishedAt / status via PATCH (use /publish, /unpublish).
  delete data.publishedAt;
  delete data.status;
  delete (data as any).slug; // slug handled above / immutable
  data.updatedAt = new Date();

  const tagSlugs = (body.tagSlugs as string[]) ?? undefined;

  const [updated] = await db
    .update(posts)
    .set(data as any)
    .where(eq(posts.id, id))
    .returning();

  if (tagSlugs) await setPostTags(id, tagSlugs);

  revalidatePath(`/blog/${updated.slug}`);
  revalidatePath("/blog");

  return NextResponse.json({ post: updated, warnings });
}

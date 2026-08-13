/**
 * POST /api/articles/{id}/publish — full publish validation → status=published.
 *  Runs: required-SEO-field check, pillar uniqueness, cannibalization,
 *  sets publishedAt on first publish. Atomic-ish (status flip + timestamp).
 *  AI drafts cannot accidentally go live via PATCH (spec §4.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { validateArticle } from "@/lib/articles/validate";
import { assertSinglePillar } from "@/lib/articles/cluster";
import { checkCannibalization } from "@/lib/articles/cannibalization";
import { getPostById, setClusterPillar } from "@/lib/articles/queries";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return unauthorized();
  const { id } = await ctx.params;

  const existing = await getPostById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Merge existing row → re-validate at publish strength
  const merged = {
    title: existing.title,
    seoTitle: existing.seoTitle,
    excerpt: existing.excerpt,
    markdownBody: existing.markdownBody,
    categoryId: existing.categoryId,
    clusterId: existing.clusterId,
    clusterRole: existing.clusterRole,
    primaryKeyword: existing.primaryKeyword,
    searchIntent: existing.searchIntent,
    country: existing.country,
    language: existing.language,
    featuredImagePath: existing.featuredImagePath,
    featuredImageAlt: existing.featuredImageAlt,
  };
  const { errors, warnings } = validateArticle(merged, "publish");
  if (errors.length > 0) return NextResponse.json({ errors }, { status: 422 });

  // Pillar uniqueness
  if (existing.clusterId && existing.clusterRole === "pillar") {
    const pillar = await assertSinglePillar(existing.clusterId, id);
    if (!pillar.ok) {
      return NextResponse.json(
        {
          errors: [
            {
              field: "clusterRole",
              code: "PILLAR_EXISTS",
              message: `Cluster already has a published pillar (${pillar.conflictId}).`,
            },
          ],
        },
        { status: 422 },
      );
    }
  }

  // Cannibalization
  if (existing.normalizedPrimaryKeyword) {
    const cann = await checkCannibalization({
      normalizedKeyword: existing.normalizedPrimaryKeyword,
      language: existing.language,
      country: existing.country,
      searchIntent: existing.searchIntent as any,
      excludePostId: id,
    });
    if (cann.blocking) {
      return NextResponse.json(
        {
          errors: [
            {
              field: "primaryKeyword",
              code: "CANNIBALIZATION",
              message: `Another published post already owns this keyword (slug: ${cann.blocking.slug}).`,
            },
          ],
        },
        { status: 422 },
      );
    }
  }

  // Flip status; publishedAt set only on first publish
  const patch: Partial<typeof posts.$inferSelect> = {
    status: "published",
    updatedAt: new Date(),
  };
  if (!existing.publishedAt) patch.publishedAt = new Date();

  const [updated] = await db.update(posts).set(patch as any).where(eq(posts.id, id)).returning();

  // Backfill cluster pillar pointer
  if (updated.clusterId && updated.clusterRole === "pillar") {
    await setClusterPillar(updated.clusterId, updated.id);
  }

  revalidatePath(`/blog/${updated.slug}`);
  revalidatePath("/blog");
  revalidatePath("/");

  return NextResponse.json({ post: updated, warnings });
}

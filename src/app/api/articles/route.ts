/**
 * POST /api/articles — create (draft or publish via status field)
 * GET  /api/articles — list (public; query: status, clusterId, categoryId, limit, offset)
 *
 * Publishing on create runs the full publish-time validation pipeline.
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { posts } from "@/db/schema";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { validateArticle } from "@/lib/articles/validate";
import { assertSinglePillar } from "@/lib/articles/cluster";
import { checkCannibalization } from "@/lib/articles/cannibalization";
import {
  ensureUniqueSlug,
  setPostTags,
  setClusterPillar,
  isoNow,
} from "@/lib/articles/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "draft" | "published" | null;
  const clusterId = url.searchParams.get("clusterId") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  // Drafts are private — require auth to list them.
  if (status === "draft" && !isAuthorized(req)) return unauthorized();

  const { listPosts } = await import("@/lib/articles/queries");
  const rows = await listPosts({ status: status ?? undefined, clusterId, categoryId, limit, offset });
  return NextResponse.json({ posts: rows });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const wantsPublish = body?.status === "published";
  const mode: "draft" | "publish" = wantsPublish ? "publish" : "draft";

  const { errors, warnings, data } = validateArticle(body, mode);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // Slug uniqueness
  const baseSlug = (data.slug as string) || "post";
  const slug = await ensureUniqueSlug(baseSlug);
  data.slug = slug;

  // Publish-only guards
  if (wantsPublish) {
    // Pillar uniqueness
    if (data.clusterId && data.clusterRole === "pillar") {
      const pillar = await assertSinglePillar(data.clusterId as string);
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
    // Cannibalization hard-block pre-check
    if (data.normalizedPrimaryKeyword) {
      const cann = await checkCannibalization({
        normalizedKeyword: data.normalizedPrimaryKeyword as string,
        language: (data.language as string) || "en",
        country: (data.country as string) || "US",
        searchIntent: data.searchIntent as any,
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
    data.publishedAt = isoNow();
  }

  // Insert
  const tagSlugs = (body.tagSlugs as string[]) ?? [];
  const [created] = await db.insert(posts).values(data as any).returning();

  // Tags
  if (tagSlugs.length > 0) await setPostTags(created.id, tagSlugs);

  // Backfill cluster pillar pointer
  if (wantsPublish && created.clusterId && created.clusterRole === "pillar") {
    await setClusterPillar(created.clusterId, created.id);
  }

  // On-demand revalidation (spec §3.9) — hours fallback configured in page.
  revalidatePath(`/blog/${created.slug}`);
  revalidatePath("/blog");
  if (created.categoryId) revalidatePath("/category");

  return NextResponse.json({ post: created, warnings }, { status: 201 });
}

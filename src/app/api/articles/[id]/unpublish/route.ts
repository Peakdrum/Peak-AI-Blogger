/**
 * POST /api/articles/{id}/unpublish — set status back to draft.
 *  Preserves publishedAt (so the original publish date is never lost).
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { getPostById } from "@/lib/articles/queries";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return unauthorized();
  const { id } = await ctx.params;

  const existing = await getPostById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db
    .update(posts)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();

  revalidatePath(`/blog/${existing.slug}`);
  revalidatePath("/blog");
  revalidatePath("/");

  return NextResponse.json({ post: updated });
}

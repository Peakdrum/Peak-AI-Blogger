/**
 * PATCH /api/keywords/{id} — update status/metrics/assignment (e.g. promote
 *  discovered → shortlisted → planned → assigned → published).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { keywords } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { getKeywordById } from "@/lib/articles/queries";
import { z } from "zod";

const patchSchema = z.object({
  keyword: z.string().min(1).max(300).optional(),
  country: z.string().max(5).optional(),
  language: z.string().max(5).optional(),
  searchIntent: z
    .enum(["informational", "commercial", "transactional", "navigational"])
    .optional(),
  searchVolume: z.number().int().nullable().optional(),
  keywordDifficulty: z.number().nullable().optional(),
  cpc: z.number().nullable().optional(),
  opportunityScore: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  checkedAt: z.string().datetime().nullable().optional(),
  assignedPostId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  status: z
    .enum(["discovered", "shortlisted", "planned", "assigned", "published", "rejected"])
    .optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return unauthorized();
  const { id } = await ctx.params;
  const existing = await getKeywordById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  const data: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.keyword) {
    const { normalizeKeyword } = await import("@/lib/slug");
    data.normalizedKeyword = normalizeKeyword(parsed.data.keyword);
  }
  // numeric() columns are strings in Drizzle/PG.
  const num = (v?: number | null) => (v == null ? v : String(v));
  if (parsed.data.keywordDifficulty !== undefined)
    data.keywordDifficulty = num(parsed.data.keywordDifficulty);
  if (parsed.data.cpc !== undefined) data.cpc = num(parsed.data.cpc);
  if (parsed.data.opportunityScore !== undefined)
    data.opportunityScore = num(parsed.data.opportunityScore);
  if (parsed.data.checkedAt !== undefined)
    data.checkedAt = parsed.data.checkedAt ? new Date(parsed.data.checkedAt) : null;

  const [updated] = await db.update(keywords).set(data as any).where(eq(keywords.id, id)).returning();
  return NextResponse.json({ keyword: updated });
}

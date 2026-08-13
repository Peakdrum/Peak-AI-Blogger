/**
 * POST /api/keywords — add a keyword to the research inventory.
 * GET  /api/keywords — list (auth required; internal research data).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { keywords } from "@/db/schema";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { normalizeKeyword } from "@/lib/slug";
import { listKeywords } from "@/lib/articles/queries";
import { z } from "zod";

export const dynamic = "force-dynamic";

const keywordCreateSchema = z.object({
  keyword: z.string().min(1).max(300),
  country: z.string().max(5).optional(),
  language: z.string().max(5).optional(),
  searchIntent: z.enum(["informational", "commercial", "transactional", "navigational"]),
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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const rows = await listKeywords({ status, limit });
  return NextResponse.json({ keywords: rows });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const parsed = keywordCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  const data = parsed.data;
  const normalizedKeyword = normalizeKeyword(data.keyword);

  // numeric() columns are strings in Drizzle/PG.
  const num = (v?: number | null) => (v == null ? v : String(v));

  try {
    const [created] = await db
      .insert(keywords)
      .values({
        ...data,
        normalizedKeyword,
        country: data.country ?? "US",
        language: data.language ?? "en",
        keywordDifficulty: num(data.keywordDifficulty),
        cpc: num(data.cpc),
        opportunityScore: num(data.opportunityScore),
        checkedAt: data.checkedAt ? new Date(data.checkedAt) : null,
      })
      .returning();
    return NextResponse.json({ keyword: created }, { status: 201 });
  } catch (err: any) {
    // Unique violation on (normalized, country, language, intent)
    if (err?.code === "23505" || /unique/i.test(err?.message ?? "")) {
      return NextResponse.json(
        {
          errors: [
            {
              field: "keyword",
              code: "DUPLICATE_KEYWORD",
              message: "This keyword already exists in the inventory for the same country/language/intent.",
            },
          ],
        },
        { status: 422 },
      );
    }
    throw err;
  }
}

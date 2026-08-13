/**
 * Cannibalization checks — two levels (spec §3.6 / §4.6):
 *   1. DB partial unique index  → HARD block on exact normalized collision.
 *      Enforced by the `posts_cannibalization_unique` index; surfaced as
 *      code:CANNIBALIZATION (23505) at the API layer.
 *   2. Soft semantic warning     → app-layer heuristic warn on near-duplicates
 *      that the exact index can't catch (e.g. "best local llm…" vs
 *      "best local models…"). Never blocks.
 */
import { db } from "../../db/client";
import { posts } from "../../db/schema";
import { eq, and, ne } from "drizzle-orm";

/** Token-overlap heuristic — surfaces likely cannibalization the index misses. */
export function semanticSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTokens(a));
  const tb = new Set(normalizeTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter / union; // Jaccard
}

function normalizeTokens(s: string): string[] {
  const stop = new Set([
    "the","a","an","for","to","of","with","and","in","on","vs","best",
    "how","what","is","are","my","your","using",
  ]);
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+|-/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !stop.has(t));
}

export type CannibalizationResult = {
  /** Hard block — exact normalized collision on a published post. */
  blocking?: { postId: string; slug: string };
  /** Soft warning — semantically similar published posts. */
  warnings: { postId: string; slug: string; keyword: string; similarity: number }[];
};

/**
 * Check a candidate published primaryKeyword against existing published posts.
 * The hard block is also enforced by the DB index; this gives a friendly pre-check.
 */
export async function checkCannibalization(opts: {
  normalizedKeyword: string;
  language: string;
  country: string;
  searchIntent: "informational" | "commercial" | "transactional" | "navigational";
  excludePostId?: string;
}): Promise<CannibalizationResult> {
  const { normalizedKeyword, language, country, searchIntent, excludePostId } = opts;
  const warnings: CannibalizationResult["warnings"] = [];

  // Pull all published posts in same locale/intent (small set) for soft checks.
  const conds = [
    eq(posts.status, "published"),
    eq(posts.language, language),
    eq(posts.country, country),
    eq(posts.searchIntent, searchIntent),
  ];
  if (excludePostId) conds.push(ne(posts.id, excludePostId));

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      primaryKeyword: posts.primaryKeyword,
      normalizedPrimaryKeyword: posts.normalizedPrimaryKeyword,
    })
    .from(posts)
    .where(and(...conds));

  let blocking: CannibalizationResult["blocking"];

  for (const r of rows) {
    if (!r.normalizedPrimaryKeyword) continue;
    // Hard: exact normalized match
    if (r.normalizedPrimaryKeyword === normalizedKeyword) {
      blocking = { postId: r.id, slug: r.slug };
      continue;
    }
    // Soft: semantic similarity ≥ 0.6
    const sim = semanticSimilarity(normalizedKeyword, r.normalizedPrimaryKeyword);
    if (sim >= 0.6) {
      warnings.push({
        postId: r.id,
        slug: r.slug,
        keyword: r.primaryKeyword ?? "",
        similarity: Math.round(sim * 100) / 100,
      });
    }
  }

  return { blocking, warnings };
}

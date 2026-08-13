/**
 * Shared DB query helpers for posts/keywords/tags (spec §3.12 — routes stay thin,
 * domain logic centralized). Supabase Postgres + postgres-js driver.
 */
import { db } from "../../db/client";
import { posts, tags, postsTags, categories, contentClusters, keywords } from "../../db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { slugify } from "../slug";

/* ───────────── Posts ───────────── */

export async function getPostBySlug(slug: string) {
  const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getPostById(id: string) {
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return rows[0] ?? null;
}

export type PostListFilter = {
  status?: "draft" | "published";
  clusterId?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
};

export async function listPosts(filter: PostListFilter = {}) {
  const { status, clusterId, categoryId, limit = 20, offset = 0 } = filter;
  const conds = [];
  if (status) conds.push(eq(posts.status, status));
  if (clusterId) conds.push(eq(posts.clusterId, clusterId));
  if (categoryId) conds.push(eq(posts.categoryId, categoryId));
  return db
    .select()
    .from(posts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset);
}

/* ───────────── Tags for a post ───────────── */

export async function getTagsForPost(postId: string) {
  const rows = await db
    .select({ id: tags.id, slug: tags.slug, name: tags.name })
    .from(postsTags)
    .innerJoin(tags, eq(tags.id, postsTags.tagId))
    .where(eq(postsTags.postId, postId));
  return rows;
}

export async function getCategoryById(id: string | null) {
  if (!id) return null;
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getClusterById(id: string | null) {
  if (!id) return null;
  const rows = await db
    .select()
    .from(contentClusters)
    .where(eq(contentClusters.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Resolve tag slugs to IDs, creating any that don't exist. Returns tag rows. */
export async function resolveOrCreateTags(tagSlugs: string[]) {
  const cleaned = Array.from(
    new Set(tagSlugs.map((s) => slugify(s)).filter(Boolean)),
  );
  if (cleaned.length === 0) return [];

  const existing = await db.select().from(tags).where(inArray(tags.slug, cleaned));
  const existingBySlug = new Map(existing.map((t) => [t.slug, t]));

  const result = [...existing];
  for (const slug of cleaned) {
    if (!existingBySlug.has(slug)) {
      const [created] = await db
        .insert(tags)
        .values({ slug, name: slug.replace(/-/g, " ") })
        .returning();
      result.push(created);
    }
  }
  return result;
}

/** Replace a post's tag associations. */
export async function setPostTags(postId: string, tagSlugs: string[]) {
  await db.delete(postsTags).where(eq(postsTags.postId, postId));
  const resolved = await resolveOrCreateTags(tagSlugs);
  if (resolved.length === 0) return resolved;
  await db
    .insert(postsTags)
    .values(resolved.map((t) => ({ postId, tagId: t.id })))
    .onConflictDoNothing();
  return resolved;
}

/* ───────────── Slug uniqueness ───────────── */

export async function slugExists(slug: string, exceptId?: string): Promise<boolean> {
  const conds = [eq(posts.slug, slug)];
  if (exceptId) {
    const row = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(...conds))
      .limit(1);
    return row.some((r) => r.id !== exceptId);
  }
  const row = await db.select({ id: posts.id }).from(posts).where(and(...conds)).limit(1);
  return row.length > 0;
}

/** Ensure a unique slug by appending -2, -3, ... if needed. */
export async function ensureUniqueSlug(base: string, exceptId?: string): Promise<string> {
  let candidate = base;
  let n = 2;
  while (await slugExists(candidate, exceptId)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

/* ───────────── Cluster pillar backfill ───────────── */

export async function setClusterPillar(clusterId: string, postId: string) {
  await db
    .update(contentClusters)
    .set({ pillarPostId: postId })
    .where(eq(contentClusters.id, clusterId));
}

/* ───────────── Keywords ───────────── */

export async function listKeywords(filter: { status?: string; limit?: number } = {}) {
  const { status, limit = 50 } = filter;
  const conds = [];
  if (status) conds.push(eq(keywords.status, status as any));
  return db
    .select()
    .from(keywords)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(keywords.createdAt))
    .limit(limit);
}

export async function getKeywordById(id: string) {
  const rows = await db.select().from(keywords).where(eq(keywords.id, id)).limit(1);
  return rows[0] ?? null;
}

/* ───────────── Misc ───────────── */

export function isoNow() {
  return new Date();
}

/** SQL value helper for raw expressions (used sparingly). */
export const raw = sql;

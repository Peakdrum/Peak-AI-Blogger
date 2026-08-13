/**
 * Cluster invariant: at most one published PILLAR per content_cluster.
 * Called from the publish path. `exceptId` lets a pillar post republish itself.
 */
import { db } from "../../db/client";
import { posts } from "../../db/schema";
import { eq, and, ne } from "drizzle-orm";

export async function assertSinglePillar(
  clusterId: string,
  exceptId?: string,
): Promise<{ ok: boolean; conflictId?: string }> {
  const conds = [
    eq(posts.clusterId, clusterId),
    eq(posts.clusterRole, "pillar"),
    eq(posts.status, "published"),
  ];
  if (exceptId) conds.push(ne(posts.id, exceptId));

  const existing = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(...conds))
    .limit(1);

  if (existing.length > 0) {
    return { ok: false, conflictId: existing[0].id };
  }
  return { ok: true };
}

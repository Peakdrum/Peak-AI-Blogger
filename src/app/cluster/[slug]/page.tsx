/** /cluster/[slug] — a topic cluster: pillar + supporting posts (internal-link hub). */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db/client";
import { contentClusters, posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { absUrl } from "@/lib/siteConfig";
import { PostCard } from "@/components/PostCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const rows = await db.select({ slug: contentClusters.slug }).from(contentClusters);
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const cluster = (await db.select().from(contentClusters).where(eq(contentClusters.slug, slug)).limit(1))[0];
  if (!cluster) return {};
  return {
    title: cluster.name,
    description: cluster.description ?? `Topic cluster: ${cluster.name}.`,
    alternates: { canonical: absUrl(`/cluster/${cluster.slug}`) },
  };
}

export default async function ClusterPage({ params }: Params) {
  const { slug } = await params;
  const cluster = (await db.select().from(contentClusters).where(eq(contentClusters.slug, slug)).limit(1))[0];
  if (!cluster) notFound();

  const all = await db.select().from(posts).where(eq(posts.clusterId, cluster.id));
  const published = all.filter((p) => p.status === "published");
  const pillar = published.find((p) => p.clusterRole === "pillar");
  const supporting = published.filter((p) => p.clusterRole !== "pillar");

  return (
    <div className="container-narrow py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: cluster.name, href: `/cluster/${cluster.slug}` }]} />
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Topic cluster</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{cluster.name}</h1>
        {cluster.description && <p className="mt-2 text-gray-600 dark:text-gray-300">{cluster.description}</p>}
      </header>

      {pillar && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-600">Pillar guide</h2>
          <PostCard post={pillar} />
        </section>
      )}

      {supporting.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Supporting guides</h2>
          <div className="grid gap-4">
            {supporting.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {published.length === 0 && <p className="text-gray-500">No posts in this cluster yet.</p>}
    </div>
  );
}

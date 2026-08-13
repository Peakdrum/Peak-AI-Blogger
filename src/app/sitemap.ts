/** /sitemap.xml — static pages + all published posts + categories + clusters. */
import type { MetadataRoute } from "next";
import { db } from "@/db/client";
import { posts, categories, contentClusters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { absUrl } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [published, cats, clusters] = await Promise.all([
    db.select({ slug: posts.slug, updatedAt: posts.updatedAt }).from(posts).where(eq(posts.status, "published")),
    db.select({ slug: categories.slug, updatedAt: categories.createdAt }).from(categories),
    db.select({ slug: contentClusters.slug, updatedAt: contentClusters.createdAt }).from(contentClusters),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absUrl("/"), lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: absUrl("/blog"), lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: absUrl("/categories"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];

  const postEntries: MetadataRoute.Sitemap = published.map((p) => ({
    url: absUrl(`/blog/${p.slug}`),
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const catEntries: MetadataRoute.Sitemap = cats.map((c) => ({
    url: absUrl(`/category/${c.slug}`),
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const clusterEntries: MetadataRoute.Sitemap = clusters.map((c) => ({
    url: absUrl(`/cluster/${c.slug}`),
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...postEntries, ...catEntries, ...clusterEntries];
}

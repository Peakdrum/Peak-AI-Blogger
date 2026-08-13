/** /rss.xml — feed of recent published posts. */
import { db } from "@/db/client";
import { posts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { siteConfig, absUrl } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const recent = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedAt))
    .limit(25);

  const items = recent
    .map(
      (p) => `
    <item>
      <title>${escapeXml(p.seoTitle ?? p.title)}</title>
      <link>${absUrl(`/blog/${p.slug}`)}</link>
      <guid isPermaLink="true">${absUrl(`/blog/${p.slug}`)}</guid>
      <pubDate>${p.publishedAt ? new Date(p.publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
      <description>${escapeXml(p.excerpt ?? "")}</description>
    </item>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <link>${absUrl("/")}</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>${siteConfig.lang}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}

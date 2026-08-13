/**
 * On-demand revalidation after ANY article change (create/update/publish/unpublish).
 * Revalidates the post + every listing/index page that depends on posts.
 * (ISR fallback is hours; this makes changes appear immediately — spec §3.9.)
 *
 * The dynamic route patterns use type:"page" so ALL matching pages are purged
 * (e.g. every /category/[slug]), not just one literal URL.
 */
import { revalidatePath } from "next/cache";

export function revalidateArticle(slug: string) {
  // The post itself + its siblings
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/blog");
  revalidatePath("/");
  // Dynamic listing pages — revalidate every instance of the pattern.
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/cluster/[slug]", "page");
  revalidatePath("/tag/[slug]", "page");
  // Static indexes + the sitemap (counts/URLs change on publish).
  revalidatePath("/categories");
  revalidatePath("/sitemap.xml", "page");
}

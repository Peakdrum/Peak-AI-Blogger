/** /robots.txt */
import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/siteConfig";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absUrl("/sitemap.xml"),
    host: absUrl("/"),
  };
}

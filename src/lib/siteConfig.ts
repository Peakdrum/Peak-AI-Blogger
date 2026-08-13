/**
 * Global site + author configuration.
 * Single source of truth for SEO metadata, JSON-LD author/publisher, and branding.
 * Edit these values — no DB row needed for the single author.
 */

export const siteConfig = {
  name: "Local AI Automation",

  /**
   * Public base URL for absolute URLs (sitemap, canonical, OG, RSS).
   * Read from NEXT_PUBLIC_SITE_URL so the dev launcher (scripts/dev.mjs)
   * can set the correct localhost port, and prod can set the real domain.
   * Falls back to a placeholder if unset.
   */
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://localaiautomation.com",

  description:
    "Practical local AI and automation tutorials for builders and businesses. Learn Ollama, n8n, local LLMs, AI agents, workflow automation, and privacy-first AI systems with step-by-step examples.",

  locale: "en_US",
  lang: "en",

  /** Default country used for new posts/keywords when none is supplied. */
  defaultCountry: "US",

  /**
   * X/Twitter account.
   * Leave empty until you have a dedicated account you want associated
   * with the site in metadata.
   */
  twitter: "",

  author: {
    name: "Piyabhum Sornpaisarn",

    /** Short bio used in Article JSON-LD author and the byline. */
    description:
      "AI automation builder and technical creator based in Bangkok, creating practical tutorials on local AI, Ollama, n8n, AI agents, and privacy-first business automation.",

    /** Avatar URL (place under /public or use an absolute URL). */
    avatar: "/author.png",

    sameAs: [
      "https://www.youtube.com/@PeakAutoAi",
    ],
  },

  nav: [
    { label: "Blog", href: "/blog" },
    { label: "Categories", href: "/categories" },
    { label: "Search", href: "/search" },
  ],
} as const;

/** Absolute URL helper (canonical, OG, sitemap, RSS). */
export function absUrl(path = "/"): string {
  const base = siteConfig.url.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
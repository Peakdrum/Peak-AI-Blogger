/**
 * Article validation — domain layer, single source of truth (spec §3.3-3.4, §3.12).
 * Pure functions, no DB access — DB-dependent checks (cannibalization, pillar
 * uniqueness) live in ./cluster.ts and ./cannibalization.ts and are called by routes.
 */
import { z } from "zod";
import { slugify, normalizeKeyword } from "../slug";

/* ───────────── Input schemas ───────────── */

export const faqItemSchema = z.object({
  q: z.string().min(1).max(500),
  a: z.string().min(1).max(500),
});

export const articleCreateSchema = z.object({
  slug: z.string().max(200).optional(),
  title: z.string().min(1).max(300),
  seoTitle: z.string().max(300).nullable().optional(),
  excerpt: z.string().max(500).nullable().optional(),
  markdownBody: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  clusterRole: z.enum(["pillar", "supporting"]).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
  primaryKeyword: z.string().max(300).nullable().optional(),
  searchIntent: z
    .enum(["informational", "commercial", "transactional", "navigational"])
    .nullable()
    .optional(),
  country: z.string().max(5).optional(),
  language: z.string().max(5).optional(),
  featuredImagePath: z.string().nullable().optional(),
  featuredImageAlt: z.string().nullable().optional(),
  ogImagePath: z.string().nullable().optional(),
  canonicalUrl: z.string().url().nullable().optional(),
  faqs: z.array(faqItemSchema).max(20).nullable().optional(),
  contentFreshness: z
    .enum(["evergreen", "quarterly", "monthly", "volatile"])
    .nullable()
    .optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  tagSlugs: z.array(z.string()).optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;

export type FieldError = { field: string; code: string; message: string };
export type ValidationResult = {
  errors: FieldError[];
  warnings: string[];
  /** Normalized payload ready to spread into the DB row (slugs/keywords normalized). */
  data: Record<string, unknown>;
};

/* ───────────── Helpers ───────────── */

/** Extract the `:::answer ... :::` block body from markdown, if present. */
export function extractAnswerSection(markdown: string): string | null {
  const m = markdown.match(/:::answer\s*\n([\s\S]*?)\n:::/);
  return m ? m[1].trim() : null;
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/* ───────────── Main validator ───────────── */

/**
 * validateArticle(input, mode)
 *  - mode='draft'  : permissive — only title required
 *  - mode='publish': full SEO validation
 * Returns { errors, warnings, data }. errors.length===0 means valid.
 */
export function validateArticle(
  raw: unknown,
  mode: "draft" | "publish",
): ValidationResult {
  const errors: FieldError[] = [];
  const warnings: string[] = [];

  const schema = mode === "publish" ? articleCreateSchema : articleCreateSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        field: issue.path.join(".") || "_",
        code: "INVALID",
        message: issue.message,
      });
    }
    return { errors, warnings, data: {} };
  }
  const input = parsed.data;
  const data: Record<string, unknown> = {};

  // Normalize slug (auto-generate from title if absent)
  let slug = input.slug;
  if (!slug && input.title) slug = slugify(input.title);
  if (slug) data.slug = slug;
  if (mode === "publish" && !slug) {
    errors.push({ field: "slug", code: "REQUIRED", message: "slug is required for publish" });
  }

  // Base fields
  if (input.title !== undefined) data.title = input.title;
  if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle ?? null;
  if (input.excerpt !== undefined) data.excerpt = input.excerpt ?? null;
  if (input.markdownBody !== undefined) data.markdownBody = input.markdownBody ?? "";
  if (input.categoryId !== undefined) data.categoryId = input.categoryId ?? null;
  if (input.clusterId !== undefined) data.clusterId = input.clusterId ?? null;
  if (input.clusterRole !== undefined) data.clusterRole = input.clusterRole ?? null;
  if (input.searchIntent !== undefined) data.searchIntent = input.searchIntent ?? null;
  if (input.featuredImagePath !== undefined)
    data.featuredImagePath = input.featuredImagePath ?? null;
  if (input.featuredImageAlt !== undefined)
    data.featuredImageAlt = input.featuredImageAlt ?? null;
  if (input.ogImagePath !== undefined) data.ogImagePath = input.ogImagePath ?? null;
  if (input.canonicalUrl !== undefined) data.canonicalUrl = input.canonicalUrl ?? null;
  if (input.contentFreshness !== undefined)
    data.contentFreshness = input.contentFreshness ?? null;
  if (input.country !== undefined) data.country = input.country;
  if (input.language !== undefined) data.language = input.language;

  // FAQs (shape already validated by zod)
  if (input.faqs !== undefined) data.faqs = input.faqs ?? null;

  // Normalize primary keyword
  if (input.primaryKeyword !== undefined) {
    const pk = input.primaryKeyword;
    data.primaryKeyword = pk;
    data.normalizedPrimaryKeyword = pk ? normalizeKeyword(pk) : null;
  }

  /* ── Conditional cluster rules (both modes) ── */
  if (input.clusterId && !input.clusterRole) {
    errors.push({
      field: "clusterRole",
      code: "REQUIRED_WITH_CLUSTER",
      message: "clusterRole is required when clusterId is set",
    });
  }
  if (!input.clusterId && input.clusterRole) {
    errors.push({
      field: "clusterRole",
      code: "CLUSTER_REQUIRED",
      message: "clusterId is required when clusterRole is set",
    });
  }

  /* ── Publish-only required SEO fields ── */
  if (mode === "publish") {
    const required: Array<[string, unknown, string]> = [
      ["title", input.title, "title is required"],
      ["excerpt", input.excerpt, "excerpt is required for publish"],
      ["markdownBody", input.markdownBody, "markdownBody is required for publish"],
      ["categoryId", input.categoryId, "categoryId is required for publish"],
      ["primaryKeyword", input.primaryKeyword, "primaryKeyword is required for publish"],
      ["searchIntent", input.searchIntent, "searchIntent is required for publish"],
    ];
    for (const [field, value, message] of required) {
      if (value === undefined || value === null || value === "") {
        errors.push({ field, code: "REQUIRED", message });
      }
    }

    // featuredImageAlt required when featuredImagePath is set
    if (input.featuredImagePath && !input.featuredImageAlt) {
      errors.push({
        field: "featuredImageAlt",
        code: "REQUIRED_WITH_IMAGE",
        message: "featuredImageAlt is required when featuredImagePath is set",
      });
    }

    // AEO answer-section soft warning (recommended 40–120 words)
    if (input.markdownBody) {
      const answer = extractAnswerSection(input.markdownBody);
      if (answer !== null) {
        const wc = countWords(answer);
        if (wc < 40 || wc > 120) {
          warnings.push(
            `Answer section is ${wc} words; recommended 40–120 words for AEO.`,
          );
        }
      } else {
        warnings.push(
          "No :::answer section found. A direct-answer block improves AEO for informational posts.",
        );
      }
    }
  }

  return { errors, warnings, data };
}

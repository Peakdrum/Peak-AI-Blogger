/**
 * Drizzle schema — implements Section 2 of the design spec.
 * Tables: categories, tags, content_clusters, keywords, posts, posts_tags.
 *
 * Two-concept separation:
 *   - keywords  = SEO research inventory (opportunities not yet written)
 *   - posts.primaryKeyword = ownership (what each published article targets)
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

/* ───────────────────────── Enums ───────────────────────── */

export const postStatus = pgEnum("post_status", ["draft", "published"]);
export const clusterRole = pgEnum("cluster_role", ["pillar", "supporting"]);
export const searchIntent = pgEnum("search_intent", [
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);
export const contentFreshness = pgEnum("content_freshness", [
  "evergreen",
  "quarterly",
  "monthly",
  "volatile",
]);
export const keywordStatus = pgEnum("keyword_status", [
  "discovered",
  "shortlisted",
  "planned",
  "assigned",
  "published",
  "rejected",
]);

/* ───────────────────────── Tables ───────────────────────── */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Topic clusters (NOT flat "series"). Circular FK with posts.pillarPostId
 * handled via Option A: create cluster (pillarPostId=null) → create pillar post
 * (clusterId + clusterRole='pillar') → backfill cluster.pillarPostId.
 */
export const contentClusters = pgTable("content_clusters", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  pillarPostId: uuid("pillar_post_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** SEO research inventory — keywords that may not have an article yet. */
export const keywords = pgTable(
  "keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    keyword: text("keyword").notNull(),
    normalizedKeyword: text("normalized_keyword").notNull(),
    country: text("country").notNull().default("US"),
    language: text("language").notNull().default("en"),
    searchIntent: searchIntent("search_intent").notNull(),
    searchVolume: integer("search_volume"),
    keywordDifficulty: numeric("keyword_difficulty"),
    cpc: numeric("cpc"),
    opportunityScore: numeric("opportunity_score"),
    source: text("source"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    assignedPostId: uuid("assigned_post_id"),
    clusterId: uuid("cluster_id"),
    status: keywordStatus("status").notNull().default("discovered"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("keywords_status_idx").on(t.status),
    index("keywords_assigned_post_idx").on(t.assignedPostId),
    index("keywords_cluster_idx").on(t.clusterId),
    uniqueIndex("keywords_unique_targeting").on(
      t.normalizedKeyword,
      t.country,
      t.language,
      t.searchIntent,
    ),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* Identity / URL */
    slug: text("slug").notNull().unique(),
    /* Titles */
    title: text("title").notNull(),
    seoTitle: text("seo_title"),
    excerpt: text("excerpt"),
    /* Body (raw markdown) */
    markdownBody: text("markdown_body").notNull(),
    /* Taxonomy */
    categoryId: uuid("category_id"),
    clusterId: uuid("cluster_id"),
    clusterRole: clusterRole("cluster_role"),
    /* Lifecycle */
    status: postStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    /* Freshness */
    contentFreshness: contentFreshness("content_freshness"),
    /* SEO ownership */
    primaryKeyword: text("primary_keyword"),
    normalizedPrimaryKeyword: text("normalized_primary_keyword"),
    searchIntent: searchIntent("search_intent"),
    country: text("country").notNull().default("US"),
    language: text("language").notNull().default("en"),
    /* Keyword metrics (all nullable, latest-only) */
    searchVolume: integer("search_volume"),
    keywordDifficulty: numeric("keyword_difficulty"),
    cpc: numeric("cpc"),
    opportunityScore: numeric("opportunity_score"),
    keywordDataSource: text("keyword_data_source"),
    keywordDataUpdatedAt: timestamp("keyword_data_updated_at", { withTimezone: true }),
    /* Images */
    featuredImagePath: text("featured_image_path"),
    featuredImageAlt: text("featured_image_alt"),
    ogImagePath: text("og_image_path"), // OG = ogImagePath ?? featuredImagePath
    /* Other */
    canonicalUrl: text("canonical_url"),
    /** Structured Q&A for readers + schema/machine understanding
     *  (NOT a Google FAQ-rich-result play — deprecated May 2026). */
    faqs: jsonb("faqs").$type<{ q: string; a: string }[]>(),
    /* Timestamps */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("posts_status_published_idx").on(t.status, t.publishedAt),
    index("posts_cluster_idx").on(t.clusterId),
    index("posts_category_idx").on(t.categoryId),
    /** Cannibalization guard (hard block, exact normalized) — published posts only.
     *  Scoped by lang/country/intent so the same keyword can be targeted in
     *  different locales. Semantic similarity is handled at the app layer (soft warn). */
    uniqueIndex("posts_cannibalization_unique")
      .on(t.normalizedPrimaryKeyword, t.language, t.country, t.searchIntent)
      .where(sql`status = 'published'`),
  ],
);

export const postsTags = pgTable(
  "posts_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

/* ───────────────────────── Relations ───────────────────────── */

export const postsRelations = relations(posts, ({ one, many }) => ({
  category: one(categories, {
    fields: [posts.categoryId],
    references: [categories.id],
  }),
  cluster: one(contentClusters, {
    fields: [posts.clusterId],
    references: [contentClusters.id],
  }),
  tags: many(postsTags),
}));

export const clusterRelations = relations(contentClusters, ({ one, many }) => ({
  pillarPost: one(posts, {
    fields: [contentClusters.pillarPostId],
    references: [posts.id],
  }),
  posts: many(posts),
}));

export const categoryRelations = relations(categories, ({ many }) => ({
  posts: many(posts),
}));

export const postsTagsRelations = relations(postsTags, ({ one }) => ({
  post: one(posts, { fields: [postsTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postsTags.tagId], references: [tags.id] }),
}));

export const keywordRelations = relations(keywords, ({ one }) => ({
  assignedPost: one(posts, {
    fields: [keywords.assignedPostId],
    references: [posts.id],
  }),
  cluster: one(contentClusters, {
    fields: [keywords.clusterId],
    references: [contentClusters.id],
  }),
}));

/* ───────────────────────── Types ───────────────────────── */

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type ContentCluster = typeof contentClusters.$inferSelect;
export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;

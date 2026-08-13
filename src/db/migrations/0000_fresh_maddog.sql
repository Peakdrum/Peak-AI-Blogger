CREATE TYPE "public"."cluster_role" AS ENUM('pillar', 'supporting');--> statement-breakpoint
CREATE TYPE "public"."content_freshness" AS ENUM('evergreen', 'quarterly', 'monthly', 'volatile');--> statement-breakpoint
CREATE TYPE "public"."keyword_status" AS ENUM('discovered', 'shortlisted', 'planned', 'assigned', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."search_intent" AS ENUM('informational', 'commercial', 'transactional', 'navigational');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"pillar_post_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_clusters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text NOT NULL,
	"normalized_keyword" text NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"search_intent" "search_intent" NOT NULL,
	"search_volume" integer,
	"keyword_difficulty" numeric,
	"cpc" numeric,
	"opportunity_score" numeric,
	"source" text,
	"checked_at" timestamp with time zone,
	"assigned_post_id" uuid,
	"cluster_id" uuid,
	"status" "keyword_status" DEFAULT 'discovered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"seo_title" text,
	"excerpt" text,
	"markdown_body" text NOT NULL,
	"category_id" uuid,
	"cluster_id" uuid,
	"cluster_role" "cluster_role",
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"content_freshness" "content_freshness",
	"primary_keyword" text,
	"normalized_primary_keyword" text,
	"search_intent" "search_intent",
	"country" text DEFAULT 'US' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"search_volume" integer,
	"keyword_difficulty" numeric,
	"cpc" numeric,
	"opportunity_score" numeric,
	"keyword_data_source" text,
	"keyword_data_updated_at" timestamp with time zone,
	"featured_image_path" text,
	"featured_image_alt" text,
	"og_image_path" text,
	"canonical_url" text,
	"faqs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "posts_tags" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "posts_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "posts_tags" ADD CONSTRAINT "posts_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_tags" ADD CONSTRAINT "posts_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "keywords_status_idx" ON "keywords" USING btree ("status");--> statement-breakpoint
CREATE INDEX "keywords_assigned_post_idx" ON "keywords" USING btree ("assigned_post_id");--> statement-breakpoint
CREATE INDEX "keywords_cluster_idx" ON "keywords" USING btree ("cluster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_unique_targeting" ON "keywords" USING btree ("normalized_keyword","country","language","search_intent");--> statement-breakpoint
CREATE INDEX "posts_status_published_idx" ON "posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "posts_cluster_idx" ON "posts" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "posts_category_idx" ON "posts" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_cannibalization_unique" ON "posts" USING btree ("normalized_primary_keyword","language","country","search_intent") WHERE status = 'published';
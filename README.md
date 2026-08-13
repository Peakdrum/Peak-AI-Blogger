# SEO/AEO Blog — Local AI Automation

A single-author, SEO/AEO-first blog for the **Local AI Automation** niche. Push-to-publish via a protected API (perfect for driving from n8n / local-LLM workflows), rendered as fast, structured, machine-readable pages.

**Stack:** Next.js 16 (App Router) · Supabase Postgres · Drizzle ORM · Tailwind v4 · Vercel

Full design spec: `../docs/superpowers/specs/2026-08-12-seo-aeo-blog-design.md`

---

## ✅ Open items (set these before launch)

1. **Site name + domain** → edit `src/lib/siteConfig.ts` (`name`, `url`)
2. **Supabase connection string** → `.env.local` `DATABASE_URL`
3. **API key** → `.env.local` `AUTH_API_KEY` (generate: `openssl rand -hex 32`)
4. **Author identity** → `src/lib/siteConfig.ts` (`author.name`, `avatar`, `sameAs`)

---

## 🚀 Setup

```bash
# 1. Configure env
cp .env.example .env.local
#   fill DATABASE_URL, AUTH_API_KEY, NEXT_PUBLIC_SITE_URL

# 2. Create the database schema
npm run db:generate     # create migration from schema.ts
npm run db:migrate      # apply to Supabase

# 3. (Optional) seed sample cluster + pillar post
npm run db:seed

# 4. Run it
npm run dev             # auto-picks a free port if 3000 is busy (prints the URL)
```

> **Dev port handling:** `npm run dev` runs `scripts/dev.mjs`, which finds the first
> free port starting at 3000 (falls back to 3001, 3002…) and sets `NEXT_PUBLIC_SITE_URL`
> to match, so canonical/OG/sitemap URLs always reflect the actual port the app is on.
> To force a specific port: `PORT=3100 npm run dev`. To bypass the wrapper: `npm run dev:next`.

> `next build` requires `DATABASE_URL` (pages query the DB at build time for static generation).

### Database commands

| Command | What it does |
|---|---|
| `npm run db:generate` | Generate SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to Supabase |
| `npm run db:push` | Sync schema directly (dev only) |
| `npm run db:studio` | Open Drizzle Studio (GUI) |
| `npm run db:seed` | Insert sample Local AI Email cluster + pillar |
| `npm run typecheck` | `tsc --noEmit` |

---

## 🔌 The publishing API

All write routes require `Authorization: Bearer <AUTH_API_KEY>`. `GET` routes are public.

### Create + publish a post in one call

```bash
curl -X POST http://localhost:3000/api/articles \
  -H "Authorization: Bearer $AUTH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Best Local LLM for Email Classification",
    "seoTitle": "7 Best Local LLMs for Email Classification Tested (2026)",
    "excerpt": "We benchmarked Qwen, Llama, and Gemma on real support emails.",
    "markdownBody": ":::answer\nFor 16GB VRAM, Qwen 2.5 7B is the best local LLM for email classification...\n:::\n\n## Full benchmarks\n...",
    "categoryId": "<uuid>",
    "clusterId": "<uuid>",
    "clusterRole": "supporting",
    "status": "published",
    "primaryKeyword": "best local llm for email classification",
    "searchIntent": "commercial",
    "country": "US",
    "language": "en",
    "featuredImagePath": "/images/bench.png",
    "featuredImageAlt": "Bar chart of F1 scores by model",
    "tagSlugs": ["ollama","benchmark"],
    "contentFreshness": "monthly",
    "faqs": [{"q":"...","a":"..."}]
  }'
```

### Editing ≠ publishing (three state transitions)

| Endpoint | Effect |
|---|---|
| `PATCH /api/articles/:id` | Partial update (drafts may be incomplete; **slug immutable after publish**) |
| `POST  /api/articles/:id/publish` | Full SEO validation → cannibalization + pillar check → set `publishedAt` |
| `POST  /api/articles/:id/unpublish` | Back to draft (preserves `publishedAt`) |

> An AI draft updating a row via `PATCH` can never accidentally go live — that's the point of the separate `/publish` endpoint.

### Keywords (research inventory)

```bash
# Add a keyword opportunity (no article yet)
curl -X POST http://localhost:3000/api/keywords \
  -H "Authorization: Bearer $AUTH_API_KEY" -H "Content-Type: application/json" \
  -d '{"keyword":"local llm invoice extraction","searchIntent":"informational"}'

# Promote status: discovered → shortlisted → planned → assigned → published
curl -X PATCH http://localhost:3000/api/keywords/:id \
  -H "Authorization: Bearer $AUTH_API_KEY" -H "Content-Type: application/json" \
  -d '{"status":"planned","clusterId":"<uuid>"}'
```

---

## 📝 AEO content structure (write these in your Markdown)

| Directive | Renders as | Purpose |
|---|---|---|
| `:::answer` … `:::` | `<section data-section="answer">` | Direct answer for AI answer engines (recommended 40–120 words) |
| `:::faq` … `:::` | `<section data-section="faq">` | Structured Q&A (also powers `FAQPage` JSON-LD when `faqs` field is set) |
| `## Heading` | slugged + auto-linked | Powers the table of contents |

FAQ rich results were **deprecated by Google in May 2026**; `faqs` is kept for readers + machine understanding, not SERP enhancements.

---

## 🧠 How keyword ownership works

Two separate concepts (do not confuse):

- **`keywords` table** = research inventory (opportunities you haven't written yet, with a status workflow)
- **`posts.primaryKeyword`** = ownership (the one query each published article targets)

**Cannibalization guard** (two levels):
1. **Hard block** — DB partial unique index on `(normalizedPrimaryKeyword, language, country, searchIntent)` for published posts → `422 CANNIBALIZATION`.
2. **Soft warn** — app-layer semantic similarity flags near-duplicates (e.g. "best local llm…" vs "best local models…") without blocking.

---

## 🗂 Project structure

```
src/
  app/
    api/articles/…          # POST/PATCH/GET + publish/unpublish
    api/keywords/…          # research inventory
    blog/[slug]/page.tsx    # SEO/AEO post page (JSON-LD, TOC, breadcrumbs, related cluster)
    category|cluster|tag/…  # listing pages
    search/ categories/     # search + topics index
    sitemap.ts robots.ts rss.xml/route.ts
  components/               # PostCard, Breadcrumbs, Toc, JsonLd
  db/                       # schema.ts (Drizzle), client.ts, migrations/
  lib/
    articles/               # validate.ts, cluster.ts, cannibalization.ts, queries.ts  ← domain layer (single source of truth)
    auth.ts markdown.tsx jsonld.ts siteConfig.ts slug.ts
scripts/seed.ts
drizzle.config.ts
```

---

## 🚢 Deploy to Vercel

1. Push this folder to a Git repo.
2. Import into Vercel.
3. Set env vars: `DATABASE_URL`, `AUTH_API_KEY`, `NEXT_PUBLIC_SITE_URL`.
4. Run migrations once: `npm run db:migrate` (or run `db:push` from local against your Supabase project).
5. Update `siteConfig.url` to your real domain (used for canonical/OG/sitemap/RSS).

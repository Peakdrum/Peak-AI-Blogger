/**
 * Seed script — creates the Local AI Email Automation cluster + a sample
 * pillar post so you can see the site populated.
 *
 * Run:  npm run db:seed   (requires DATABASE_URL in .env.local)
 */
import "dotenv/config";
import { db } from "../src/db/client";
import {
  categories,
  contentClusters,
  posts,
  tags,
  type NewPost,
} from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  // 1. Category
  const [cat] =
    await db.select().from(categories).where(eq(categories.slug, "local-ai")).limit(1);
  const category =
    cat ??
    (
      await db
        .insert(categories)
        .values({
          slug: "local-ai",
          name: "Local AI",
          description: "Running AI models on your own hardware — Ollama, local LLMs, and private automation.",
        })
        .returning()
    )[0];

  // 2. Cluster
  const [cl] =
    await db
      .select()
      .from(contentClusters)
      .where(eq(contentClusters.slug, "local-ai-email-automation"))
      .limit(1);
  const cluster =
    cl ??
    (
      await db
        .insert(contentClusters)
        .values({
          slug: "local-ai-email-automation",
          name: "Local AI Email Automation",
          description: "Build a private AI email assistant with Ollama + n8n — no OpenAI required.",
        })
        .returning()
    )[0];

  // 3. Sample pillar post (draft — publish via the API to test the full flow)
  const existing = await db
    .select()
    .from(posts)
    .where(eq(posts.slug, "local-ai-email-assistant-ollama-n8n"))
    .limit(1);
  if (existing.length === 0) {
    const pillar: NewPost = {
      slug: "local-ai-email-assistant-ollama-n8n",
      title: "How to Build a Private AI Email Assistant with Ollama + n8n",
      seoTitle: "Private AI Email Assistant with Ollama + n8n (No OpenAI) — 2026 Guide",
      excerpt:
        "A complete walkthrough of building a privacy-first AI email assistant using Ollama for local LLM inference and n8n for automation — no cloud APIs required.",
      markdownBody: `## Intro

Most AI email tools send your messages to OpenAI or Google. If you handle support, invoices, or customer data, that's a problem. This guide shows a fully private alternative.

:::answer
A local AI email assistant uses **Ollama** to run a small LLM on your hardware and **n8n** to read, classify, and act on emails — without any data leaving your network. For a 16GB GPU, a 7B–8B model (Qwen 2.5 or Llama 3.1) classifies email reliably at 5–15 emails/minute.
:::

## What you need

- Ollama installed locally
- n8n (self-hosted or desktop)
- A Gmail app password (or IMAP credentials)

## Step 1 — Pick a local LLM

For email classification, small fast models beat large slow ones.

\`\`\`bash
ollama pull qwen2.5:7b
\`\`\`

## Step 2 — Connect n8n to Ollama

Use the HTTP Request node against \`http://host.docker.internal:11434/api/chat\` if n8n runs in Docker.

## Step 3 — Build the classification flow

(coming soon — supporting articles cover each step in depth.)

:::faq
Q: Does this work without a GPU?
A: Yes, but CPU inference is 5–10× slower. A quantized 7B model is usable on CPU for low volume.
:::
`,
      categoryId: category.id,
      clusterId: cluster.id,
      clusterRole: "pillar",
      status: "draft",
      primaryKeyword: "local ai email assistant ollama n8n",
      searchIntent: "informational",
      country: "US",
      language: "en",
      contentFreshness: "quarterly",
      faqs: [
        { q: "Does this work without a GPU?", a: "Yes, but CPU inference is 5–10× slower. A quantized 7B model is usable on CPU for low volume." },
      ],
    };
    const [created] = await db.insert(posts).values(pillar).returning();
    await db
      .update(contentClusters)
      .set({ pillarPostId: created.id })
      .where(eq(contentClusters.id, cluster.id));
    console.log(`✓ Seeded pillar post: ${created.slug} (draft — publish via POST /api/articles/${created.id}/publish)`);
  } else {
    console.log("• Pillar post already exists, skipping.");
  }

  // 4. A couple of tags
  for (const t of [
    { slug: "ollama", name: "ollama" },
    { slug: "n8n", name: "n8n" },
    { slug: "gmail", name: "gmail" },
  ]) {
    const [exists] = await db.select().from(tags).where(eq(tags.slug, t.slug)).limit(1);
    if (!exists) await db.insert(tags).values(t);
  }

  console.log("\n✅ Seed complete. Next:");
  console.log("   npm run dev   → http://localhost:3000");
  console.log("   Then publish the pillar via the API to see it on the homepage.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

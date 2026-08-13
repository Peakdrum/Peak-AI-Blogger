/**
 * Slug + keyword normalization helpers.
 *  - slugify(): URL-safe slugs (lowercase, kebab-case)
 *  - normalizeKeyword(): lowercase, collapse whitespace, strip punctuation —
 *    used for the cannibalization index so "Best local LLM!" and
 *    "best local llm" collide.
 */
import slugifyLib from "slugify";

export function slugify(input: string): string {
  return slugifyLib(input, { lower: true, strict: true, trim: true });
}

export function normalizeKeyword(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // keep letters/numbers/spaces/hyphens (unicode-aware)
    .replace(/\s+/g, " ")
    .trim();
}

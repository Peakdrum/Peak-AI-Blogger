/**
 * Markdown renderer (spec §3.7, §3.10, §3.11).
 *  - `:::answer` / `:::faq` directives → stable `<section data-section="...">`
 *    (NOT heading-text matching — editors can rename headings freely)
 *  - Stored raw; sanitized at render with an extended allowlist
 *  - Headings get slugged IDs (rehype-slug) + autolinks
 *  - Tailwind-styled elements
 */
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import GithubSlugger from "github-slugger";

/* ───────────── AEO directive plugin (mdast) ─────────────
 * Converts :::answer / :::faq container directives into
 * `<section data-section="answer|faq">` so content has stable machine-readable
 * semantics regardless of the visible heading wording. */
function remarkAeoDirectives() {
  return function transform(tree: any) {
    walk(tree);
  };
  function walk(node: any) {
    if (!node) return;
    if (
      node.type === "containerDirective" &&
      (node.name === "answer" || node.name === "faq" || node.name === "intro")
    ) {
      const data = node.data || (node.data = {});
      data.hName = "section";
      data.hProperties = {
        dataSection: node.name,
        className: `aeo-section aeo-${node.name}`,
      };
    }
    if (node.children) node.children.forEach(walk);
  }
}

/* ───────────── Sanitize schema (extended from default) ───────────── */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: Array.from(new Set([...(defaultSchema.tagNames ?? []), "section"])),
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    section: ["data-section", "className"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
    div: [...(defaultSchema.attributes?.div ?? []), "className"],
    a: [...(defaultSchema.attributes?.a ?? []), "className"],
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id"],
  },
};

const REHYPE_OPTIONS = {
  behavior: "wrap", // wrap heading text in an anchor (linkable)
} as const;

/* ───────────── Component map (Tailwind styles) ───────────── */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 mb-4 text-3xl font-bold tracking-tight md:text-4xl">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 border-b pb-1 text-2xl font-semibold tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-2 text-xl font-semibold tracking-tight">{children}</h3>
  ),
  p: ({ children }) => <p className="my-4 leading-7 text-[1.05rem]">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} className="text-blue-600 underline decoration-blue-300 hover:decoration-blue-600 dark:text-blue-400">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-4 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:text-gray-300">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    return isInline ? (
      <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-gray-800" {...props}>
        {children}
      </code>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm leading-6 text-gray-100">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 px-3 py-2 text-left font-semibold bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-3 py-2 dark:border-gray-700">{children}</td>
  ),
  section: ({ children, ...props }) => {
    const ds = (props as any)["data-section"] as string | undefined;
    const cls =
      ds === "answer"
        ? "my-6 rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950/30"
        : ds === "faq"
          ? "my-6 rounded-lg border-l-4 border-violet-500 bg-violet-50 p-4 dark:bg-violet-950/30"
          : ds === "intro"
            ? "my-6 text-lg text-gray-600 dark:text-gray-300"
            : "my-6";
    return (
      <section {...props} className={cls}>
        {ds && (
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            {ds === "answer" ? "Direct answer" : ds}
          </span>
        )}
        {children}
      </section>
    );
  },
};

type Components = React.ComponentProps<typeof ReactMarkdown>["components"];

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <article className="prose-blog">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDirective, remarkAeoDirectives]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, REHYPE_OPTIONS],
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

/* ───────────── TOC extraction (matches rehype-slug via github-slugger) ───────────── */
export type TocItem = { level: number; text: string; id: string };

export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  const lines = markdown.split("\n");
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (m) {
      const level = m[1].length;
      const text = m[2].replace(/[#*`]/g, "").trim();
      if (!text) continue;
      items.push({ level, text, id: slugger.slug(text) });
    }
  }
  return items;
}

/* ───────────── Word count (render-time derived, never stored) ───────────── */
export function wordCount(markdown: string): number {
  // Strip fenced code + directive fences for a fairer count of prose.
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/:::[\w]*[\s\S]*?:::/g, " ")
    .replace(/[#>*_`-]/g, " ");
  return stripped.trim().split(/\s+/).filter(Boolean).length;
}

export function readingTime(minutes: number): string {
  if (minutes < 1) return "1 min read";
  return `${Math.round(minutes)} min read`;
}

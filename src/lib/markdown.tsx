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

/* ───────────── Component map (editorial prose, no underlined headings) ───────────── */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display mt-10 mb-5 text-3xl font-semibold leading-[1.15] tracking-tight md:text-4xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display mt-12 mb-3 text-[1.7rem] font-semibold leading-snug tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display mt-9 mb-2 text-xl font-semibold tracking-tight text-accent">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-5 text-[1.06rem] leading-[1.75] text-foreground/90">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-accent underline decoration-accent/35 underline-offset-2 transition-colors hover:decoration-accent"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="my-5 space-y-2 pl-5 text-[1.06rem] leading-[1.7] [li::marker]:text-accent">{children}</ul>,
  ol: ({ children }) => <ol className="my-5 list-decimal space-y-2 pl-5 text-[1.06rem] leading-[1.7] [li::marker]:text-accent">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-2 border-accent pl-5 font-display text-lg italic text-ink-soft">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-0 text-center before:content-['•••'] before:text-ink-soft before:tracking-[0.5em]" />,
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    return isInline ? (
      <code className="rounded-[0.35rem] bg-muted px-1.5 py-0.5 font-mono text-[0.84em] text-accent" {...props}>
        {children}
      </code>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="font-mono my-6 overflow-x-auto rounded-xl border border-border bg-surface p-4 text-[0.85rem] leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-muted px-3.5 py-2.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3.5 py-2.5 text-ink-soft">{children}</td>
  ),
  section: ({ children, ...props }) => {
    const ds = (props as any)["data-section"] as string | undefined;
    const cls =
      ds === "answer"
        ? "my-8 rounded-2xl border border-accent/25 bg-accent-soft/50 p-5 md:p-6"
        : ds === "faq"
          ? "my-8 rounded-2xl border border-border bg-muted/60 p-5 md:p-6"
          : ds === "intro"
            ? "my-6 font-display text-xl leading-relaxed text-ink-soft"
            : "my-6";
    return (
      <section {...props} className={cls}>
        {ds && (
          <span className="mb-3 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {ds === "answer" ? "Direct answer" : ds === "faq" ? "FAQ" : ds}
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

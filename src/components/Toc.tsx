/** Sticky table of contents from extracted headings. */
import { TocItem } from "@/lib/markdown";

export function Toc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          On this page
        </h2>
        <nav>
          <ul className="space-y-1.5 border-l border-gray-200 text-sm dark:border-gray-700">
            {items.map((it) => (
              <li
                key={it.id}
                className={it.level === 3 ? "ml-3" : ""}
                style={{ marginLeft: it.level === 3 ? "0.75rem" : 0 }}
              >
                <a
                  href={`#${it.id}`}
                  className="-ml-px block border-l border-transparent pl-3 text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {it.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

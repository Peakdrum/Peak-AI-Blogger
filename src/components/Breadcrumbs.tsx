/** Simple breadcrumb nav (visual). JSON-LD BreadcrumbList emitted separately. */
export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={it.href} className="flex items-center gap-1">
            {i < items.length - 1 ? (
              <>
                <a className="hover:underline" href={it.href}>
                  {it.name}
                </a>
                <span aria-hidden>›</span>
              </>
            ) : (
              <span className="text-gray-700 dark:text-gray-300">{it.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

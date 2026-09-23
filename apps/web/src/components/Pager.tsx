import Link from "next/link";

// Previous / page of pages / next, for any server-rendered listing. Renders nothing for a single
// page. `href` builds the link for a page number, so each listing keeps its own query string.
export function Pager({
  page,
  total,
  pageSize,
  href,
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center gap-3 small" aria-label="Pages">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn btn-sm no-underline" rel="prev">
          ← Previous
        </Link>
      ) : null}
      <span className="mono muted">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="btn btn-sm no-underline" rel="next">
          Next →
        </Link>
      ) : null}
    </nav>
  );
}

import { Link, useLocation, useSearchParams } from 'react-router-dom';
import type { CategoryNode } from '@/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/StateMessage';
import { useCategories } from '@/hooks/catalog';
import { getErrorMessage } from '@/utils/errors';

const linkBase = 'block rounded px-2 py-1 text-sm hover:bg-ink-800 hover:text-accent-400';
const linkActive = 'bg-ink-800 font-semibold text-accent-400';
const linkIdle = 'text-parchment-200';

function CategoryItems({
  nodes,
  activeSlug,
  depth,
}: {
  nodes: readonly CategoryNode[];
  activeSlug: string | undefined;
  depth: number;
}) {
  return (
    <ul className={depth > 0 ? 'ml-3 border-l border-ink-700 pl-2' : 'flex flex-col gap-0.5'}>
      {nodes.map((node) => (
        <li key={node.id}>
          <Link
            to={`/books?category=${encodeURIComponent(node.slug)}`}
            aria-current={node.slug === activeSlug ? 'true' : undefined}
            className={`${linkBase} ${node.slug === activeSlug ? linkActive : linkIdle}`}
          >
            {node.name}
          </Link>
          {node.children.length > 0 ? (
            <CategoryItems nodes={node.children} activeSlug={activeSlug} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Category hierarchy from `GET /categories` (wireframe image1). The `Category` schema only has
 * `id/name/slug/children`, so "All" is the only synthetic entry; Recommended/Bestsellers are
 * home-page sections, not categories or search filters.
 */
export default function CategorySidebar() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { data, isPending, error, refetch } = useCategories();

  const onBrowse = pathname === '/books';
  const activeSlug = onBrowse ? (params.get('category') ?? undefined) : undefined;

  let tree;
  if (error) {
    tree = <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  } else if (isPending) {
    tree = (
      <div role="status" aria-label="Loading categories" className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  } else {
    tree = <CategoryItems nodes={data} activeSlug={activeSlug} depth={0} />;
  }

  return (
    <aside
      aria-label="Categories"
      data-testid="category-sidebar"
      className="hidden w-52 shrink-0 border-r border-ink-700 pr-4 md:block"
    >
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-parchment-400">
        Categories
      </h2>
      <nav aria-label="Category navigation" className="flex flex-col gap-0.5">
        <Link
          to="/books"
          aria-current={onBrowse && !activeSlug ? 'true' : undefined}
          className={`${linkBase} ${onBrowse && !activeSlug ? linkActive : linkIdle}`}
        >
          All
        </Link>
        {tree}
      </nav>
    </aside>
  );
}

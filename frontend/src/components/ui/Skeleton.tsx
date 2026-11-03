/** Animated placeholder block shown while data loads. Decorative, hidden from assistive tech. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-ink-700 ${className}`} />;
}

export function BookCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
      <Skeleton className="h-36 w-24 shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="mt-auto h-5 w-1/4" />
      </div>
    </div>
  );
}

/** Placeholder grid announced to screen readers as a single busy region. */
export function BookGridSkeleton({ count = 6, label = 'Loading books' }: SkeletonGridProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}

interface SkeletonGridProps {
  count?: number;
  label?: string;
}

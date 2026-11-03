interface StarRatingProps {
  /** Rating from 0 to 5 (fractions are rounded to the nearest star). */
  value: number;
  className?: string;
}

/** Read-only star display with an accessible text alternative. */
export default function StarRating({ value, className = '' }: StarRatingProps) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      role="img"
      aria-label={`Rated ${value.toFixed(1)} out of 5`}
      className={`inline-flex text-accent-400 ${className}`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden="true" className={i < filled ? '' : 'text-ink-600'}>
          ★
        </span>
      ))}
    </span>
  );
}

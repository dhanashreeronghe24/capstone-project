import { useState, type FormEvent } from 'react';
import type { CategoryNode } from '@/api';
import { Button } from '@/components/ui/Button';
import { useCategories } from '@/hooks/catalog';
import {
  BOOK_FORMATS,
  BOOK_SORTS,
  FORMAT_LABELS,
  LANGUAGE_OPTIONS,
  SORT_LABELS,
  hasActiveFilters,
  type BookFilters,
  type BookSort,
} from '@/utils/book-filters';
import type { BookFormat } from '@/api';

interface BookFilterBarProps {
  filters: BookFilters;
  onChange: (patch: Partial<BookFilters>) => void;
  onClear: () => void;
}

const selectClass =
  'rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-sm text-parchment-50 focus:border-accent-400 focus:outline-none';
const labelClass = 'flex flex-col gap-1 text-xs text-parchment-400';

function flatten(
  nodes: readonly CategoryNode[],
  depth = 0,
): { node: CategoryNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

function parsePrice(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Price range as a small form so the URL (and request) change once, on Apply. */
function PriceRange({ filters, onChange }: Pick<BookFilterBarProps, 'filters' | 'onChange'>) {
  const [min, setMin] = useState(filters.minPrice?.toString() ?? '');
  const [max, setMax] = useState(filters.maxPrice?.toString() ?? '');
  const minValue = parsePrice(min);
  const maxValue = parsePrice(max);
  const invalid = minValue !== undefined && maxValue !== undefined && minValue > maxValue;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    onChange({ minPrice: minValue, maxPrice: maxValue });
  };

  return (
    <form onSubmit={onSubmit} aria-label="Price range" className="flex items-end gap-2">
      <label className={labelClass}>
        Min price (₹)
        <input
          type="number"
          min={0}
          inputMode="decimal"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className={`${selectClass} w-24`}
        />
      </label>
      <label className={labelClass}>
        Max price (₹)
        <input
          type="number"
          min={0}
          inputMode="decimal"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          className={`${selectClass} w-24`}
        />
      </label>
      <Button type="submit" variant="secondary" className="px-3 py-1.5" disabled={invalid}>
        Apply
      </Button>
      {invalid ? (
        <span role="alert" className="text-xs text-danger">
          Min price must not exceed max price.
        </span>
      ) : null}
    </form>
  );
}

/** Filter row from wireframe image1: Category, Language, Format, Price Range, Sort By. */
export default function BookFilterBar({ filters, onChange, onClear }: BookFilterBarProps) {
  const { data: categories } = useCategories();
  const categoryOptions = categories ? flatten(categories) : [];
  const languages =
    filters.language && !LANGUAGE_OPTIONS.some((l) => l === filters.language)
      ? [filters.language, ...LANGUAGE_OPTIONS]
      : LANGUAGE_OPTIONS;

  return (
    <div
      role="group"
      aria-label="Filters"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3"
    >
      <label className={labelClass}>
        Category
        <select
          value={filters.category ?? ''}
          onChange={(e) => onChange({ category: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All</option>
          {categoryOptions.map(({ node, depth }) => (
            <option key={node.id} value={node.slug}>
              {`${'\u00a0\u00a0'.repeat(depth)}${node.name}`}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Language
        <select
          value={filters.language ?? ''}
          onChange={(e) => onChange({ language: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All</option>
          {languages.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Format
        <select
          value={filters.format ?? ''}
          onChange={(e) =>
            onChange({ format: (e.target.value || undefined) as BookFormat | undefined })
          }
          className={selectClass}
        >
          <option value="">All</option>
          {BOOK_FORMATS.map((format) => (
            <option key={format} value={format}>
              {FORMAT_LABELS[format]}
            </option>
          ))}
        </select>
      </label>
      {/* Remount when the URL values change (e.g. Clear all, back button) to resync the inputs. */}
      <PriceRange
        key={`${filters.minPrice ?? ''}-${filters.maxPrice ?? ''}`}
        filters={filters}
        onChange={onChange}
      />
      <label className={labelClass}>
        Sort by
        <select
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as BookSort })}
          className={selectClass}
        >
          {BOOK_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </select>
      </label>
      {hasActiveFilters(filters) ? (
        <Button variant="ghost" className="px-3 py-1.5" onClick={onClear}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

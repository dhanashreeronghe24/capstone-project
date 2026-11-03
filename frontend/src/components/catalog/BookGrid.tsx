import type { BookSummary } from '@/api';
import BookCard from './BookCard';

/** Responsive grid of book cards (browse results). */
export default function BookGrid({ books }: { books: readonly BookSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {books.map((book) => (
        <li key={book.id}>
          <BookCard book={book} />
        </li>
      ))}
    </ul>
  );
}

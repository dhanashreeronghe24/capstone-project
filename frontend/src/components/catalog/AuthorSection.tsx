import type { BookDetail } from '@/api';
import { useAuthor } from '@/hooks/catalog';

/**
 * "About the writer" (wireframe image3). Uses `GET /authors/{id}` for the bio and avatar and
 * falls back to the book's `authorBio` while loading or if the author request fails.
 */
export default function AuthorSection({ book }: { book: BookDetail }) {
  const { data: author } = useAuthor(book.author.id);
  const name = author?.name ?? book.author.name;
  const bio = author?.bio ?? book.authorBio;
  const avatarUrl = author?.avatarUrl;

  return (
    <section aria-labelledby="about-writer-heading" className="flex flex-col gap-3">
      <h2 id="about-writer-heading" className="font-serif text-xl text-accent-400">
        About the writer
      </h2>
      <div className="flex gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Photo of ${name}`}
            className="h-20 w-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-ink-700 font-serif text-2xl text-accent-400"
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-serif text-lg text-parchment-50">{name}</p>
          <p className="text-sm leading-relaxed text-parchment-200">
            {bio || 'No biography is available for this author yet.'}
          </p>
        </div>
      </div>
    </section>
  );
}

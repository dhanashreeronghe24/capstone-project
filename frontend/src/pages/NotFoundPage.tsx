import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-serif text-6xl text-accent-400">404</p>
      <h1 className="text-2xl text-parchment-50">Page not found</h1>
      <p className="text-parchment-400">The page you are looking for does not exist.</p>
      <Link to="/" className="text-accent-400 hover:underline">
        Back to the bookstore
      </Link>
    </section>
  );
}

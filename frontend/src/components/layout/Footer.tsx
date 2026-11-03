import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-ink-700 bg-ink-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-parchment-400 sm:flex-row">
        <p>© {new Date().getFullYear()} BookWorm. All rights reserved.</p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link to="/books" className="hover:text-accent-400">
            Browse books
          </Link>
          <Link to="/orders" className="hover:text-accent-400">
            My Orders
          </Link>
        </nav>
      </div>
    </footer>
  );
}

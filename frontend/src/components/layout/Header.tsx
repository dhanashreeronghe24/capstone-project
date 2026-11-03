import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, createSearchParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useLogout } from '@/hooks/auth';
import { useCart } from '@/hooks/cart';
import { selectIsAuthenticated, toast, useAuthStore } from '@/stores';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm hover:text-accent-400 ${isActive ? 'text-accent-400' : 'text-parchment-200'}`;

function SearchBar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);

  // Keep the input in step with URL changes (back/forward, clearing filters, category links).
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    navigate({
      pathname: '/books',
      search: q ? createSearchParams({ q }).toString() : '',
    });
  };

  return (
    <form role="search" onSubmit={onSubmit} className="flex flex-1 items-center gap-2">
      <label htmlFor="header-search" className="sr-only">
        Search books
      </label>
      <input
        id="header-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a title, author or ISBN"
        className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-parchment-50 placeholder:text-parchment-400 focus:border-accent-400 focus:outline-none"
      />
      <Button type="submit" variant="secondary" aria-label="Search" className="px-3 py-1.5">
        Search
      </Button>
    </form>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const firstName = useAuthStore((s) => s.user?.firstName);
  const { data: cart } = useCart();
  const logout = useLogout();
  const itemCount = cart?.itemCount ?? 0;

  const onLogout = async () => {
    await logout.mutateAsync();
    toast.success('You have been logged out.');
    navigate('/', { replace: true });
  };

  return (
    <header className="border-b border-ink-700 bg-ink-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="font-serif text-xl font-semibold text-accent-400">
          Book Worm
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4">
          <NavLink to="/orders" className={navLinkClass}>
            My Orders
          </NavLink>
          <NavLink to="/wishlist" className={navLinkClass}>
            My Wishlist
          </NavLink>
        </nav>
        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
          <SearchBar />
        </div>
        <nav aria-label="Account" className="ml-auto flex items-center gap-4">
          <NavLink to="/cart" className={navLinkClass} aria-label={`Cart, ${itemCount} items`}>
            Cart
            {itemCount > 0 ? (
              <span
                data-testid="cart-count"
                className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent-500 px-1.5 text-xs font-semibold text-ink-950"
              >
                {itemCount}
              </span>
            ) : null}
          </NavLink>
          <NavLink to="/profile" className={navLinkClass}>
            {isAuthenticated && firstName ? `Profile (${firstName})` : 'Profile'}
          </NavLink>
          {isAuthenticated ? (
            <Button variant="ghost" onClick={() => void onLogout()} disabled={logout.isPending}>
              Log out
            </Button>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass}>
                Log in
              </NavLink>
              <NavLink to="/register" className={navLinkClass}>
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

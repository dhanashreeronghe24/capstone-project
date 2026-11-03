import { Outlet, useLocation, useMatches } from 'react-router-dom';
import CategorySidebar from '@/components/catalog/CategorySidebar';
import { useSessionExpiryWatcher } from '@/hooks/session';
import ErrorBoundary from './ErrorBoundary';
import Footer from './Footer';
import Header from './Header';
import ToastViewport from './ToastViewport';

/** Route `handle` flags read by the layout. */
export interface LayoutRouteHandle {
  /** Show the category sidebar beside the page content (home, browse). */
  sidebar?: boolean;
}

export default function Layout() {
  const location = useLocation();
  const matches = useMatches();
  useSessionExpiryWatcher();

  const showSidebar = matches.some((m) => (m.handle as LayoutRouteHandle | undefined)?.sidebar);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-parchment-100">
      <Header />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        {showSidebar ? <CategorySidebar /> : null}
        <main className="min-w-0 flex-1">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <Footer />
      <ToastViewport />
    </div>
  );
}

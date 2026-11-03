import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import Layout, { type LayoutRouteHandle } from '@/components/layout/Layout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import BookDetailPage from '@/pages/BookDetailPage';
import BrowsePage from '@/pages/BrowsePage';
import CartPage from '@/pages/CartPage';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import NotFoundPage from '@/pages/NotFoundPage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import RegisterPage from '@/pages/RegisterPage';
import RouteErrorPage from '@/pages/RouteErrorPage';
import WishlistPage from '@/pages/WishlistPage';

const withSidebar: LayoutRouteHandle = { sidebar: true };

/**
 * Full route table. Pages marked `PlaceholderPage` are replaced by their owning sub-task
 * (the `plannedIn` prop) without changing paths.
 */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <HomePage />, handle: withSidebar },
      { path: '/books', element: <BrowsePage />, handle: withSidebar },
      { path: '/books/:bookId', element: <BookDetailPage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/wishlist', element: <WishlistPage /> },
          { path: '/profile', element: <PlaceholderPage title="My Profile" plannedIn={7} /> },
          { path: '/checkout', element: <PlaceholderPage title="Checkout" plannedIn={8} /> },
          { path: '/orders', element: <PlaceholderPage title="My Orders" plannedIn={10} /> },
          {
            path: '/orders/:orderId',
            element: <PlaceholderPage title="Order Details" plannedIn={10} />,
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

// Opt in to React Router v7 behaviour early (also silences future-flag warnings).
export const routerFutureFlags = {
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;

export const router = createBrowserRouter(routes, { future: routerFutureFlags });

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { selectIsAuthenticated, useAuthStore } from '@/stores';
import { loginPathWithRedirect } from '@/utils/redirect';

/** Renders nested routes for signed-in users; otherwise redirects to login with a return URL. */
export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={loginPathWithRedirect(`${location.pathname}${location.search}${location.hash}`)}
        replace
      />
    );
  }
  return <Outlet />;
}

import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';

/** Route-level `errorElement`: renders 404s for unmatched data routes and unexpected errors. */
export default function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <section role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl text-parchment-50">
        {notFound ? 'Page not found' : 'Something went wrong'}
      </h1>
      <p className="text-parchment-400">
        {notFound
          ? 'The page you are looking for does not exist.'
          : 'An unexpected error occurred. Please try again.'}
      </p>
      <Link to="/" className="text-accent-400 hover:underline">
        Back to the bookstore
      </Link>
    </section>
  );
}

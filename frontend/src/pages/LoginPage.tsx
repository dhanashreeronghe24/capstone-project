import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useLogin } from '@/hooks/auth';
import { loginFields, loginSchema, type LoginFormValues } from '@/schemas/auth.schema';
import { selectIsAuthenticated, toast, useAuthStore } from '@/stores';
import { applyApiErrorsToForm } from '@/utils/errors';
import { REDIRECT_PARAM, safeRedirectPath } from '@/utils/redirect';

export default function LoginPage() {
  const [params] = useSearchParams();
  const redirectTo = safeRedirectPath(params.get(REDIRECT_PARAM));
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const login = useLogin();
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (isAuthenticated && !login.isPending) {
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormErrors([]);
    try {
      const { user } = await login.mutateAsync(values);
      toast.success(`Welcome back, ${user.firstName}!`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const { unmatched } = applyApiErrorsToForm<LoginFormValues>(error, setError, loginFields);
      setFormErrors(unmatched);
    }
  });

  return (
    <section className="mx-auto w-full max-w-md rounded-lg border border-ink-700 bg-ink-900 p-6">
      <h1 className="mb-4 font-serif text-2xl text-accent-400">Log in</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formErrors.length > 0 ? (
          <div role="alert" className="rounded-md border border-danger p-3 text-sm text-danger">
            {formErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-parchment-400">
        New to BookWorm?{' '}
        <Link
          className="text-accent-400 hover:underline"
          to={`/register${params.get(REDIRECT_PARAM) ? `?${REDIRECT_PARAM}=${encodeURIComponent(redirectTo)}` : ''}`}
        >
          Create an account
        </Link>
      </p>
    </section>
  );
}

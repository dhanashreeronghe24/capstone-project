import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useRegister } from '@/hooks/auth';
import { registerFields, registerSchema, type RegisterFormValues } from '@/schemas/auth.schema';
import { selectIsAuthenticated, toast, useAuthStore } from '@/stores';
import { applyApiErrorsToForm } from '@/utils/errors';
import { REDIRECT_PARAM, safeRedirectPath } from '@/utils/redirect';

export default function RegisterPage() {
  const [params] = useSearchParams();
  const redirectTo = safeRedirectPath(params.get(REDIRECT_PARAM));
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const registerUser = useRegister();
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '', phoneNumber: '' },
  });

  if (isAuthenticated && !registerUser.isPending) {
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = handleSubmit(async ({ phoneNumber, ...values }) => {
    setFormErrors([]);
    try {
      const { user } = await registerUser.mutateAsync({
        ...values,
        ...(phoneNumber ? { phoneNumber } : {}),
      });
      toast.success(`Welcome to BookWorm, ${user.firstName}!`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const { unmatched } = applyApiErrorsToForm<RegisterFormValues>(
        error,
        setError,
        registerFields,
      );
      setFormErrors(unmatched);
    }
  });

  return (
    <section className="mx-auto w-full max-w-md rounded-lg border border-ink-700 bg-ink-900 p-6">
      <h1 className="mb-4 font-serif text-2xl text-accent-400">Create your account</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formErrors.length > 0 ? (
          <div role="alert" className="rounded-md border border-danger p-3 text-sm text-danger">
            {formErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="First name"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          error={errors.phoneNumber?.message}
          {...register('phoneNumber')}
        />
        <Button type="submit" disabled={registerUser.isPending}>
          {registerUser.isPending ? 'Creating account…' : 'Register'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-parchment-400">
        Already have an account?{' '}
        <Link
          className="text-accent-400 hover:underline"
          to={`/login${params.get(REDIRECT_PARAM) ? `?${REDIRECT_PARAM}=${encodeURIComponent(redirectTo)}` : ''}`}
        >
          Log in
        </Link>
      </p>
    </section>
  );
}

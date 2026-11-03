import { forwardRef, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
}

/** Labelled input with an accessible error message (`aria-invalid` + `aria-describedby`). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const inputId = id ?? `field-${rest.name ?? label}`;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm text-parchment-200">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-md border bg-ink-900 px-3 py-2 text-parchment-50 placeholder:text-parchment-400 focus:border-accent-400 focus:outline-none ${
          error ? 'border-danger' : 'border-ink-600'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});

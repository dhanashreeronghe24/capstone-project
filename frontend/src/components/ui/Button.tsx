import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-ink-950 hover:bg-accent-400 disabled:bg-ink-600 disabled:text-parchment-400',
  secondary:
    'border border-ink-600 bg-ink-800 text-parchment-100 hover:bg-ink-700 disabled:opacity-60',
  ghost: 'text-parchment-200 hover:bg-ink-800 disabled:opacity-60',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

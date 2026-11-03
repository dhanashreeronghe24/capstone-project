import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;
export const loginFields = [
  'email',
  'password',
] as const satisfies readonly (keyof LoginFormValues)[];

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(255, 'Email is too long')
    .email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  firstName: z.string().trim().min(1, 'First name is required').max(100, 'First name is too long'),
  lastName: z.string().trim().min(1, 'Last name is required').max(100, 'Last name is too long'),
  /** Optional; an empty string is treated as "not provided". */
  phoneNumber: z.string().trim().max(20, 'Phone number is too long').optional(),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;
export const registerFields = [
  'email',
  'password',
  'firstName',
  'lastName',
  'phoneNumber',
] as const satisfies readonly (keyof RegisterFormValues)[];

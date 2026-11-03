import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phoneNumber: z.string().trim().max(20).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const UpdateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phoneNumber: z.string().trim().max(20).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const AddressInputSchema = z.object({
  recipientName: z.string().trim().min(1).max(150),
  phoneNumber: z.string().trim().min(1).max(20),
  addressLine1: z.string().trim().min(1).max(255),
  addressLine2: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().regex(/^[0-9]{6}$/, 'postalCode must be a 6-digit PIN'),
  country: z.string().trim().min(1).max(100).default('India'),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof AddressInputSchema>;

export const IdParamSchema = z.object({ id: z.string().uuid() });

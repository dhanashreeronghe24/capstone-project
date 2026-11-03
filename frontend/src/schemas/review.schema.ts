import { z } from 'zod';

export const REVIEW_COMMENT_MAX = 2000;

export const reviewSchema = z.object({
  rating: z
    .number({ required_error: 'Select a rating', invalid_type_error: 'Select a rating' })
    .int('Select a rating')
    .min(1, 'Select a rating')
    .max(5, 'Select a rating'),
  /** Optional; an empty comment is omitted from the request. */
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX, `Review must be at most ${REVIEW_COMMENT_MAX} characters`)
    .optional(),
});
export type ReviewFormValues = z.infer<typeof reviewSchema>;
export const reviewFields = [
  'rating',
  'comment',
] as const satisfies readonly (keyof ReviewFormValues)[];

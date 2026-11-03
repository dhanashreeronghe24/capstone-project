import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useCreateReview } from '@/hooks/reviews';
import {
  REVIEW_COMMENT_MAX,
  reviewFields,
  reviewSchema,
  type ReviewFormValues,
} from '@/schemas/review.schema';
import { selectIsAuthenticated, useAuthStore } from '@/stores';
import { applyApiErrorsToForm, getErrorMessage, hasStatus } from '@/utils/errors';
import { loginPathWithRedirect } from '@/utils/redirect';

const STARS = [1, 2, 3, 4, 5] as const;

/** Review form for members; guests get a login prompt that returns them to this page. */
export default function ReviewForm({ bookId }: { bookId: string }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const createReview = useCreateReview(bookId);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { comment: '' },
  });
  const commentLength = (watch('comment') ?? '').length;

  if (!isAuthenticated) {
    return (
      <p className="rounded-lg border border-ink-700 bg-ink-900 p-4 text-sm text-parchment-200">
        <Link
          to={loginPathWithRedirect(`${location.pathname}${location.search}`)}
          className="text-accent-400 underline hover:text-accent-500"
        >
          Log in
        </Link>{' '}
        to leave a review.
      </p>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const comment = values.comment?.trim();
    try {
      await createReview.mutateAsync({ rating: values.rating, ...(comment ? { comment } : {}) });
      reset({ comment: '' });
    } catch (error) {
      // 400 field errors are shown inline; every other rejection (403/409/422...) is form-level
      // and uses the server's `detail` (e.g. "You have already reviewed this book").
      if (hasStatus(error, 400)) {
        const { unmatched } = applyApiErrorsToForm(error, setError, reviewFields);
        if (unmatched.length > 0) setFormError(unmatched.join(' '));
        return;
      }
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-3">
      <Controller
        control={control}
        name="rating"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm text-parchment-200">Your rating</legend>
            <div className="flex gap-1">
              {STARS.map((star) => (
                <label key={star} className="cursor-pointer text-2xl leading-none">
                  <input
                    type="radio"
                    name="rating"
                    value={star}
                    checked={field.value === star}
                    onChange={() => field.onChange(star)}
                    onBlur={field.onBlur}
                    aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={
                      field.value !== undefined && star <= field.value
                        ? 'text-accent-400'
                        : 'text-ink-600 hover:text-accent-500'
                    }
                  >
                    ★
                  </span>
                </label>
              ))}
            </div>
            {errors.rating ? (
              <p role="alert" className="text-sm text-danger">
                {errors.rating.message}
              </p>
            ) : null}
          </fieldset>
        )}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="review-comment" className="text-sm text-parchment-200">
          Leave your review
        </label>
        <textarea
          id="review-comment"
          rows={4}
          placeholder="Share what you thought about this book"
          aria-invalid={errors.comment ? true : undefined}
          aria-describedby={errors.comment ? 'review-comment-error' : undefined}
          className={`rounded-md border bg-ink-900 px-3 py-2 text-parchment-50 placeholder:text-parchment-400 focus:border-accent-400 focus:outline-none ${
            errors.comment ? 'border-danger' : 'border-ink-600'
          }`}
          {...register('comment')}
        />
        <div className="flex justify-between text-xs text-parchment-400">
          <span>
            {errors.comment ? (
              <span id="review-comment-error" role="alert" className="text-sm text-danger">
                {errors.comment.message}
              </span>
            ) : null}
          </span>
          <span>
            {commentLength}/{REVIEW_COMMENT_MAX}
          </span>
        </div>
      </div>
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-danger/60 p-3 text-sm text-parchment-100"
        >
          {formError}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={createReview.isPending}>
          {createReview.isPending ? 'Submitting…' : 'Submit review'}
        </Button>
      </div>
    </form>
  );
}

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/api/errors';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = 'Unable to reach the server. Check your connection and try again.';

export interface MappedFormErrors<T extends FieldValues> {
  /** Field errors applied to the form via `setError`. */
  applied: Path<T>[];
  /** Messages that could not be attached to a known field; show them as a form-level alert. */
  unmatched: string[];
}

/**
 * Maps a Problem's `errors[]` onto React Hook Form fields.
 *
 * Backend field paths are dotted (`shippingAddress.postalCode`) and may carry a leading source
 * segment (`body.`/`query.`/`params.`); both are handled. Pass `knownFields` (the form's field
 * names) to route unrecognised paths into `unmatched` rather than creating phantom errors.
 */
export function applyApiErrorsToForm<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields?: readonly Path<T>[],
): MappedFormErrors<T> {
  const result: MappedFormErrors<T> = { applied: [], unmatched: [] };
  if (!(error instanceof ApiError)) {
    result.unmatched.push(getErrorMessage(error));
    return result;
  }
  if (error.errors.length === 0) {
    result.unmatched.push(error.detail || error.title);
    return result;
  }
  for (const fieldError of error.errors) {
    const field = normaliseFieldPath(fieldError.field);
    const matches = (name: string) =>
      knownFields === undefined || knownFields.includes(name as Path<T>);
    if (field && matches(field)) {
      setError(field as Path<T>, { type: 'server', message: fieldError.message });
      result.applied.push(field as Path<T>);
    } else {
      result.unmatched.push(fieldError.message);
    }
  }
  return result;
}

function normaliseFieldPath(field: string): string {
  return field.replace(/^(body|query|params)\./, '');
}

/** Friendly, user-facing message for any thrown value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return NETWORK_MESSAGE;
    if (error.status >= 500) return GENERIC_MESSAGE;
    return error.detail || error.title || GENERIC_MESSAGE;
  }
  if (error instanceof Error && error.message) return error.message;
  return GENERIC_MESSAGE;
}

/** True when the error is an ApiError with one of the given HTTP statuses. */
export function hasStatus(error: unknown, ...statuses: number[]): boolean {
  return error instanceof ApiError && statuses.includes(error.status);
}

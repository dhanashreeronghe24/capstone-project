import type { Problem } from './types';

export interface ProblemFieldError {
  field: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseFieldErrors(raw: unknown): ProblemFieldError[] {
  if (!Array.isArray(raw)) return [];
  const result: ProblemFieldError[] = [];
  for (const entry of raw) {
    if (isRecord(entry) && typeof entry.message === 'string') {
      result.push({
        field: typeof entry.field === 'string' ? entry.field : '',
        message: entry.message,
      });
    }
  }
  return result;
}

/** Error thrown for every non-2xx response and for transport failures (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly errors: ProblemFieldError[];
  readonly timestamp: string;
  /** Value of the `x-correlation-id` response header, when available. */
  readonly correlationId: string | undefined;

  constructor(problem: Problem, correlationId?: string) {
    super(problem.detail || problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.title = problem.title;
    this.detail = problem.detail;
    this.errors = normaliseFieldErrors(problem.errors);
    this.timestamp = problem.timestamp;
    this.correlationId = correlationId;
  }

  /**
   * Builds an ApiError from a parsed response body. RFC 7807 bodies are used as-is; anything
   * else (HTML from a proxy, plain text, empty body) is wrapped into a synthetic Problem.
   */
  static fromResponse(response: Response, body: unknown): ApiError {
    const correlationId = response.headers.get('x-correlation-id') ?? undefined;
    if (isRecord(body) && typeof body.title === 'string') {
      return new ApiError(
        {
          status: typeof body.status === 'number' ? body.status : response.status,
          title: body.title,
          detail: typeof body.detail === 'string' ? body.detail : body.title,
          errors: normaliseFieldErrors(body.errors),
          timestamp: typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString(),
        },
        correlationId,
      );
    }
    const title = response.statusText || `HTTP ${response.status}`;
    return new ApiError(
      {
        status: response.status,
        title,
        detail: typeof body === 'string' && body.trim() ? body.trim().slice(0, 300) : title,
        timestamp: new Date().toISOString(),
      },
      correlationId,
    );
  }

  /** Wraps a fetch/network failure (no HTTP response was received). */
  static fromNetworkError(cause: unknown): ApiError {
    const detail = cause instanceof Error ? cause.message : 'Network request failed';
    const error = new ApiError({
      status: 0,
      title: 'Network Error',
      detail,
      timestamp: new Date().toISOString(),
    });
    error.cause = cause;
    return error;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

import { ApiError } from '@/api/errors';
import { problemFixture } from '@/test/fixtures';
import { applyApiErrorsToForm, getErrorMessage, hasStatus } from './errors';
import { newIdempotencyKey } from './idempotency';
import { discountPercent, formatINR, roundMoney } from './money';

describe('money', () => {
  it('formats INR with lakh grouping', () => {
    expect(formatINR(1299)).toBe('₹1,299.00');
    expect(formatINR(1234567.5)).toBe('₹12,34,567.50');
    expect(formatINR(399, { hideZeroDecimals: true })).toBe('₹399');
    expect(formatINR(Number.NaN)).toBe('₹0.00');
  });

  it('rounds to two decimals and computes discount percent', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(discountPercent(399, 499)).toBe(20);
    expect(discountPercent(399, null)).toBe(0);
    expect(discountPercent(499, 399)).toBe(0);
  });
});

describe('idempotency', () => {
  it('generates unique UUID v4 keys', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('error utils', () => {
  interface Form {
    email: string;
    shippingAddress: { postalCode: string };
  }

  it('maps Problem.errors[] to form fields and collects unmatched messages', () => {
    const error = new ApiError(
      problemFixture({
        errors: [
          { field: 'body.email', message: 'Invalid email' },
          { field: 'shippingAddress.postalCode', message: 'Must be 6 digits' },
          { field: 'unknown', message: 'Mystery' },
        ],
      }),
    );
    const setError = vi.fn();

    const result = applyApiErrorsToForm<Form>(error, setError, [
      'email',
      'shippingAddress.postalCode',
    ]);

    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Invalid email' });
    expect(setError).toHaveBeenCalledWith('shippingAddress.postalCode', {
      type: 'server',
      message: 'Must be 6 digits',
    });
    expect(result.applied).toEqual(['email', 'shippingAddress.postalCode']);
    expect(result.unmatched).toEqual(['Mystery']);
  });

  it('falls back to detail when there are no field errors', () => {
    const setError = vi.fn();
    const result = applyApiErrorsToForm<Form>(
      new ApiError(
        problemFixture({ status: 409, title: 'Conflict', detail: 'Email already registered' }),
      ),
      setError,
    );
    expect(setError).not.toHaveBeenCalled();
    expect(result.unmatched).toEqual(['Email already registered']);
  });

  it('produces friendly messages and status checks', () => {
    expect(getErrorMessage(ApiError.fromNetworkError(new Error('boom')))).toMatch(
      /Unable to reach/,
    );
    expect(
      getErrorMessage(new ApiError(problemFixture({ status: 500, detail: 'stack trace' }))),
    ).toBe('Something went wrong. Please try again.');
    expect(
      getErrorMessage(new ApiError(problemFixture({ status: 422, detail: 'Out of stock' }))),
    ).toBe('Out of stock');
    expect(hasStatus(new ApiError(problemFixture({ status: 409 })), 409, 422)).toBe(true);
    expect(hasStatus(new Error('x'), 409)).toBe(false);
  });
});

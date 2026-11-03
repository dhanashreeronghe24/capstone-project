# Project Coding & Architecture Rules

## 1. Code Standards & TypeScript
- Use TypeScript with strict type checking enabled. Avoid using `any`; define explicit interfaces or use Zod-inferred types (`z.infer<typeof Schema>`).
- Always validate incoming request bodies, query params, and route params using Zod middleware before hitting controllers.
- Use `async/await` with centralized asynchronous error forwarding to the global Express error middleware.

## 2. API Design & Spec Consistency
- Follow RESTful resource naming conventions (plural nouns, kebab-case for compound paths).
- Always align endpoint paths, request bodies, and response structures with the OpenAPI 3.0 specification (`docs/openapi/openapi.yaml`).
- Return standard HTTP status codes:
  - `200 OK` for successful fetches and updates
  - `201 Created` for resource creations
  - `204 No Content` for deletions
  - `400 Bad Request` for validation failures
  - `401 Unauthorized` for missing/invalid JWT tokens
  - `403 Forbidden` for role permission violations
  - `404 Not Found` for non-existent entities
  - `409 Conflict` for duplicate entries or concurrency conflicts
  - `422 Unprocessable Entity` for domain validation failures

## 3. Database & Prisma
- Always use Prisma Client for database queries.
- Multi-step stateful changes (e.g. order creation with stock reservation and cart clearance) must run inside `prisma.$transaction`.
- Never store raw card numbers, CVVs, or plain text passwords. Always hash passwords using `bcryptjs` with salt rounds $\ge 10$.

## 4. Payment Mocking Guidelines
- Payment processing is decoupled using `PaymentGatewayAdapter`.
- Always use `MockPaymentGatewayAdapter` for payments and refunds.
- Deterministic simulation rules:
  - Card ending in `0000` $\rightarrow$ `DECLINED` / `PAYMENT_FAILED`
  - Any other valid test card/UPI $\rightarrow$ `SUCCESS` with generated `MOCK_TXN_<uuid>`

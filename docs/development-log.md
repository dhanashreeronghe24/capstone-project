# BookWorm Backend — Development Log

**Phase:** Implementation (Agent mode), spec-driven, following `backend-architecture-plan.md` Section 10
**Location of code:** `backend/` · **Contract:** `docs/openapi/openapi.yaml`
**Final state:** 9/9 sub-tasks complete · 6 test suites / 49 tests passing · coverage 93% statements, 97% lines · `tsc --noEmit` clean · `npm run build` clean

---

## 1. Environment findings
| Check | Result |
| :--- | :--- |
| Node / npm | v22.17.0 / 10.9.2 |
| PostgreSQL, `psql`, Docker | Not installed / not running |
| Resolution | Added dev dependency `embedded-postgres` and `backend/tests/scripts/dev-db.ts` (`npm run db:dev`) to run a local PostgreSQL 18 on port 5432 (`postgres`/`postgres`, DB `bookworm_db`, data in `backend/.pgdata`). |

Wireframes (images 1, 4, 5, 6) were reviewed to shape seed data (book titles/prices), checkout totals (price, tax, delivery, coupon, discount), payment methods (Credit, Debit, UPI, Wallet) and the purchase confirmation flow.

---

## 2. Work completed per sub-task

### Sub-Task 1 — OpenAPI 3.0 contract
- Created `docs/openapi/openapi.yaml` (OpenAPI 3.0.3): all endpoints from plan Section 7, plus `GET /health` and `PATCH /api/v1/orders/{orderId}/status`.
- Shared components: bearer JWT security scheme, pagination/guest-session/idempotency parameters, reusable RFC 7807 `Problem` responses (400/401/403/404/409/422).
- Later corrected: `CreateOrderRequest` now requires `addressId` **or** `shippingAddress` (`anyOf`), matching the implementation.

### Sub-Task 2 — Scaffolding, Prisma, migrations, seed
- `package.json` (scripts: `dev`, `build`, `start`, `typecheck`, `test`, `test:coverage`, `prisma:*`, `db:dev`), strict `tsconfig.json`, `jest.config.js`, `.env.example` (+ local `.env`).
- `prisma/schema.prisma` — all Section 8.1 tables, plus an added `refresh_tokens` table.
- Migrations: `20260101000000_init` (generated via `prisma migrate diff`) and `20260101000001_check_constraints` (hand-written CHECKs: price/stock ≥ 0, rating 1–5, quantity > 0, discount > 0, order totals ≥ 0, refund > 0). Both applied.
- `prisma/seed.ts` — 5 roles, 4 demo users, 23 categories (Fiction / Non-Fiction hierarchy), 9 wireframe books (Art of Focus, Art of Learning, Path to Success, Midnight Hour, Beneath the Stars, Final Frontier, Joy of Minimalism, Vanishing House, Lost Kitten), coupons `WELCOME10` and `FLAT50`, 9 pincode zones, 8 shipping-rate rows. Idempotent (upserts).
- Cross-cutting code: `env.config.ts` (Zod-validated env), `prisma.client.ts`, `http-error.ts` (typed errors + `asyncHandler`), `money.ts`, `logger.ts`, and middlewares: auth (JWT + `requireRole` + `optionalAuth`), Zod `validate`, RFC 7807 error handler, rate limiter, correlation-ID/Morgan logging.

### Sub-Task 3 — Security & members
- `member.{schema,service,controller,routes}.ts`; `/api/v1/auth/{register,login,refresh,logout}` and `/api/v1/members/me[/addresses[/:id]]`.
- bcryptjs with ≥ 10 salt rounds; refresh tokens stored as SHA-256 hashes, rotated on use (reuse rejected), revoked on logout.
- First address auto-becomes default; setting a new default clears the old one (transaction).

### Sub-Task 4 — Catalog
- Search (title/author/publisher text, category incl. child categories, author, format, language, price range), sorts (relevance, price asc/desc, publication date, rating), pagination.
- Category tree, PDP, featured sections (recommended / bestsellers / new launches), deterministic related reads (shared category or author, ranked by sales), author profile.
- Reviews: one per user per book, verified-purchase flag derived from orders, book rating aggregate recalculated in the same transaction.
- Admin create/update book (`ROLE_CATALOG_ADMIN`) with ISBN conflict check.

### Sub-Task 5 — Cart & wishlist
- Guest carts via `x-guest-session-id` (server mints a token if absent and echoes it in header + body); user carts via JWT.
- Stock-checked add/update, live catalog price in totals, cart merge on login in one transaction (quantities summed, capped at stock, guest cart deleted).
- Wishlist add/list/remove and atomic move-to-cart.

### Sub-Task 8 — Shipping (built before Sub-Tasks 6/7 because orders depend on it)
- Zone lookup by pincode; rate = base + per-kg × weight; free above the zone threshold (499); STANDARD vs EXPRESS rates and delivery days; unserviceable pincode → 422.
- Shipment creation (tracking number), delivered marker and tracking milestones.

### Sub-Task 7 — Payments
- `PaymentGatewayAdapter` interface (`initiatePayment`, `verifyPayment`, `processWebhook`, `processRefund`) and `MockPaymentGatewayAdapter`.
- Mock rules: card ending `0000` → declined; ending `9999` → insufficient funds; expired card → declined; UPI id starting `fail` → declined; everything else → `SUCCESS` with `MOCK_TXN_<uuid>`; refunds → `MOCK_REF_<uuid>`.
- Only last-4 / UPI id / wallet id are kept in `gateway_response_raw`; PAN and CVV are never persisted (asserted in tests).
- On success, one transaction: order `PAYMENT_PENDING → CONFIRMED` + conditional stock deduction (insufficient stock rolls the whole payment back with 422). Confirm is idempotent. Webhook simulation and admin full/partial refunds (over-refund rejected) implemented.

### Sub-Task 6 — Orders & coupons
- Single pricing function (`computePricing`) shared by checkout preview and order creation: subtotal, tax, shipping, coupon discount, reward points.
- `POST /orders` requires `Idempotency-Key`; replay returns the original order with 200; key reuse by another user → 409; concurrent duplicate handled via unique-violation fallback.
- Order creation transaction: snapshot items/address, record coupon usage (limit-guarded), deduct reward points (balance-guarded), write status history, clear cart.
- State machine in `order.lifecycle.ts` (illegal transitions → 422, optimistic concurrency).
- Cancel (releases points and coupon usage; refunds + restores stock if already paid), return within 7 days of delivery, staff status progression (shipment created on SHIPPED, refund + stock restore on RETURNED → REFUNDED), buy-again (stock-capped), order history with status filter, coupon validation.

### Sub-Task 9 — Testing, validation, docs
- Swagger UI mounted at `/api-docs` from the same YAML file.
- Test suites: `auth` (10), `catalog` (5), `cart` (5), `shipping` (6), `order-payment` (18), `contract` (5) = **49 tests**.
- `contract.test.ts`: validates the spec with swagger-parser, verifies every documented operation is routed, checks Swagger UI, and validates live response bodies and status codes across the purchase journey against the documented schemas (Ajv).
- `backend-architecture-plan.md`: all nine sub-task statuses changed to `[x] completed`.

---

## 3. Issues hit and how they were resolved
| Issue | Resolution |
| :--- | :--- |
| `backend/.gitignore` could not be created (tool ignore-pattern guard) | Skipped; must be added manually. |
| Coupon test failed (`WELCOME10` min order 200, cart was 149) | Test corrected to build a 508 cart first. |
| Payment test used UPI `a@b.c`, rejected by the UPI regex (400 instead of 404) | Test now uses `abc@bank`. |
| Ajv "circular" stack overflow on dereferenced spec (recursive `CategoryNode`) | Contract helper now parses the spec without dereferencing and resolves `$ref`s via `components`. |
| Contract test cleanup failed on FK from reviews → users, leaving book stats modified | Cleanup now deletes reviews and restores book stock/sales/rating and coupon usage; re-ran seed to restore data. |
| `npm start` pointed at `dist/server.js`, build emits `dist/src/server.js` | Fixed `main` and `start` in `package.json`; compiled server smoke-tested (`/health`, `/catalog/featured`, `/api-docs` all 200). |
| `OPENAPI_PATH` would break in compiled output | `openapi.ts` now walks up directories to find `docs/openapi/openapi.yaml`. |
| Draft `order.service.ts` had a nonexistent import, a stray re-export and a badly named helper | Cleaned up immediately; typecheck clean. |

---

## 4. Design decisions beyond the plan
- Added `refresh_tokens` table and `PATCH /orders/{id}/status` (needed for token rotation and for `ROLE_FULFILLMENT` to drive the lifecycle).
- Unique review per (book, user).
- Flat 0.4 kg per book for shipping weight (no weight column exists); 2% flat tax (`TAX_RATE`); 1 point = ₹1 (`POINT_VALUE`); 7-day return window.
- Refund on payment failure/decline keeps the order `PAYMENT_PENDING` so the customer can retry.

---

## 5. Known gaps / follow-ups
- Add `backend/.gitignore` (`node_modules`, `dist`, `.env`, `coverage`, `.pgdata`).
- Prisma warns that the `package.json#prisma` block is deprecated; migrate to `prisma.config.ts`.
- Branch coverage is 77%; lowest areas are the error middleware (unhandled-error paths) and the mock adapter's wallet/webhook-failure branches.
- Guest checkout order creation is not implemented (`POST /orders` is customer-only, as in the plan's endpoint table); only checkout *summary* supports guests.
- `ROLE_SYSTEM` has no endpoints yet (no background jobs in scope).
- Node-level `npm audit` reported advisories in transitive dev dependencies; not reviewed.

---

## 6. How to run
```powershell
cd backend
npm install
npm run db:dev            # terminal 1: local PostgreSQL (or point DATABASE_URL at your own)
npx prisma migrate deploy # terminal 2
npm run prisma:seed
npm run dev               # http://localhost:4000  (Swagger UI: /api-docs)
npm test                  # or: npm run test:coverage
```
Demo users (password `Password@123`): `customer@`, `catalog@`, `admin@`, `fulfillment@` `bookworm.test`.

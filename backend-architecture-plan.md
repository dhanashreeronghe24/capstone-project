# BookWorm E-Commerce Platform — Backend Architecture & Planning Specification

**Document Version:** 2.0.0  
**Methodology:** Spec-Driven Development (OpenAPI 3.0 Contract-First)  
**Target Stack:** Node.js (v20+ LTS) / Express.js / TypeScript / PostgreSQL / Prisma ORM / JWT / Zod / Swagger / Jest & Supertest

---

## 1. Executive Summary & Top-Level Overview

This architectural planning document establishes the technical blueprint for the **BookWorm** online bookstore backend platform. The system facilitates end-to-end e-commerce operations: multi-criteria catalog browsing, personalized recommendations, shopping cart management, seamless checkout, multi-method payment processing (with mock gateway simulation), order lifecycle tracking, and shipping rate/delivery calculation.

Following **Spec-Driven Development (SDD)**, all domain boundaries, schema models, and RESTful OpenAPI 3.0 contracts are formally defined prior to any backend code implementation. The backend runtime is built on **Node.js with Express.js and TypeScript**, using **Prisma ORM** for type-safe database access to **PostgreSQL**.

---

## 2. Functional Requirements

### 2.1 Member & Identity Domain
- **FR-MEM-01 (Guest Session):** Support anonymous guest browsing, cart creation, and persistent guest session token tracking (`x-guest-session-id`).
- **FR-MEM-02 (User Registration & Authentication):** Support email/password registration, login, JWT access token issuance, refresh token rotation, and logout.
- **FR-MEM-03 (Profile Management):** Registered users can view and update personal profile details, contact numbers, and default shipping addresses.
- **FR-MEM-04 (Role & Entitlement Management):** Enforce Role-Based Access Control (RBAC) ensuring appropriate data access and administrative action rights.

### 2.2 Store & Catalog Domain
- **FR-CAT-01 (Category & Taxonomy):** Hierarchical category navigation (e.g., Fiction, Non-Fiction, Self-Help, Mystery, Romance, Sci-Fi, History, Philosophy, etc.).
- **FR-CAT-02 (Product Discovery & Filtering):** Multi-attribute search and filtering by Title, Author (Writer), Publisher, Format (Paperback, Hardcover, eBook), Language, Price Range, and Sorting (Relevance, Price: Low to High, Price: High to Low, Publication Date, Rating).
- **FR-CAT-03 (Product Details Page - PDP):** Retrieve comprehensive book details: cover images (front/back), description, author biography, publisher details, ISBN, format options, pricing, stock availability, star ratings, and sales figures.
- **FR-CAT-04 (Recommendations & Merchandising):** Curated product segments: *Recommended for You*, *Bestsellers this Month*, *New Launches*, and *Related Reads* (Cross-sell/Up-sell on PDP).
- **FR-CAT-05 (Wishlist Management):** Registered users can save items to a personal wishlist and move items between cart and wishlist.
- **FR-CAT-06 (Ratings & Reviews):** Verified users can submit star ratings (1–5) and textual reviews; display aggregated average rating and verified review history.

### 2.3 Cart & Checkout Domain
- **FR-CRT-01 (Cart Operations):** Add items, update quantities (+/-), remove items, and clear cart for both guest and registered sessions.
- **FR-CRT-02 (Cart Merge):** Seamlessly merge guest session cart items into the registered customer cart upon successful login.
- **FR-CRT-03 (Price Calculation & Totals):** Real-time computation of item subtotal, applicable taxes (e.g., GST/VAT), delivery fees, discount deductions, and final payable amount.
- **FR-CRT-04 (Coupon & Promotions):** Validate and apply promo codes, deducting discounts from order totals with expiration and minimum order value validations.
- **FR-CRT-05 (Loyalty & Gift Points):** Support redemption of accumulated reward points against total checkout value.

### 2.4 Order Management Domain
- **FR-ORD-01 (Order Placement & Checkout):** Transition cart to checkout, capture shipping/billing addresses, select payment methods, and generate an immutable order snapshot.
- **FR-ORD-02 (Order State Lifecycle):** Manage state machine transitions: `CREATED` $\rightarrow$ `PAYMENT_PENDING` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED` $\rightarrow$ `CANCELLED` / `RETURN_REQUESTED` $\rightarrow$ `RETURNED` $\rightarrow$ `REFUNDED`.
- **FR-ORD-03 (Order History & Invoicing):** Allow customers to view past order history, line items, itemized invoices, payment breakdowns, and track order fulfillment status.
- **FR-ORD-04 (Buy Again):** Enable one-click re-ordering of previously purchased items directly from order history.
- **FR-ORD-05 (Order Cancellation & Returns):** Allow customers to initiate order cancellations prior to dispatch, and submit return requests within the policy window.

### 2.5 Payment Domain (Mocked Gateway Implementation)
- **FR-PAY-01 (Mock Payment Orchestration):** Provide an internal mock payment gateway simulating Credit Card, Debit Card, UPI, and Digital Wallet transactions.
- **FR-PAY-02 (Deterministic Test Scenarios):** Support deterministic test payment instruments (e.g., standard test cards for `SUCCESS`, special trigger numbers like ending with `0000` for `FAILURE`, and invalid CVV/expiry for `DECLINED`).
- **FR-PAY-03 (Mock Payment Verification & Callbacks):** Simulate synchronous payment confirmation and asynchronous webhook callbacks with generated mock transaction reference IDs (`MOCK_TXN_xxxx`).
- **FR-PAY-04 (Mock Refund Processing):** Trigger simulated instant full or partial refunds upon verified order cancellation or return acceptance with mock refund reference IDs (`MOCK_REF_xxxx`).
- **FR-PAY-05 (Adapter Pattern for Swappability):** Define a clean `PaymentGatewayAdapter` interface with the `MockPaymentGatewayAdapter` implementation, enabling seamless plug-and-play migration to production payment gateways (e.g., Stripe, Razorpay) in future phases without altering core business logic.

### 2.6 Shipping & Logistics Domain
- **FR-SHP-01 (Address Validation):** Capture and validate delivery addresses including postal PIN code, street, city, state, and contact phone.
- **FR-SHP-02 (Shipping Rate Calculation):** Dynamic rate calculation based on weight, destination postal code, and selected shipping tier (Standard vs Express).
- **FR-SHP-03 (Estimated Delivery Date - EDD):** Compute and display approximate delivery dates across product cards, cart, checkout, and order confirmation.
- **FR-SHP-04 (Shipment Tracking & Returns):** Assign carrier tracking numbers and track transit stages up to delivery and reverse pickup logistics.

---

## 3. Non-Functional Requirements (NFRs)

| Category | Requirement Specification | Metric / Target |
| :--- | :--- | :--- |
| **Performance** | API response time for read operations (Catalog, PDP, Search) | $p95 < 120\text{ ms}$, $p99 < 250\text{ ms}$ under baseline load |
| **Throughput** | End-to-end checkout & payment initiation throughput | Support $\ge 300$ write TPS with sub-second response times |
| **Availability** | High availability and uptime for core service APIs | $99.95\%$ uptime target |
| **Scalability** | Stateless Node.js event-driven runtime with PM2 / Docker clustering | Auto-scale backend Node.js worker containers horizontally |
| **Security** | Authentication, authorization, and data encryption | JWT (HMAC-SHA256), `bcryptjs` password hashing, Helmet security headers, CORS, rate-limiting |
| **PCI-DSS Compliance** | Zero persistence of raw credit/debit card numbers or CVV | Gateway tokenization only; card inputs handled via mock/PCI tokens |
| **Idempotency** | Prevent duplicate orders and double billing on network retry | Enforce `Idempotency-Key` header on `/orders` and `/payments` endpoints |
| **Data Integrity** | ACID compliance for checkout, inventory deduction, and wallet transactions | Prisma interactive transactions (`prisma.$transaction`) with strict isolation |
| **Auditability** | Full audit logs for state transitions and financial transactions | Winston / Pino structured JSON logging with correlation IDs |

---

## 4. User Roles & RBAC Matrix

| Role | Description | Permissions & Entitlements |
| :--- | :--- | :--- |
| **Guest User (`ROLE_GUEST`)** | Anonymous visitor without an active account | Browse catalog, search/filter books, view PDP, view reviews, add items to guest cart, initiate checkout with guest details. |
| **Registered Customer (`ROLE_CUSTOMER`)** | Authenticated shopper | All Guest capabilities + manage profile, save multiple addresses, manage wishlist, submit book reviews/ratings, apply coupons/gift points, view order history, "Buy Again", cancel/return orders. |
| **Catalog Manager (`ROLE_CATALOG_ADMIN`)** | Back-office merchandiser | Create/edit/delete books, categories, author profiles, publisher records; manage featured collections, up-sell/cross-sell relations, and inventory stock levels. |
| **Store Operations / Admin (`ROLE_STORE_ADMIN`)** | Platform administrator | Create store policies, manage coupon/promotional rules, view platform analytics, manage user roles, oversee payment disputes and refund authorizations. |
| **Fulfillment / Support Specialist (`ROLE_FULFILLMENT`)** | Warehouse and customer support agent | Update shipment statuses, assign carrier tracking numbers, process return pickups, view customer order details to assist support queries. |
| **System / Automated Worker (`ROLE_SYSTEM`)** | Internal background jobs and workers | Trigger recommendation updates, reconcile payment webhooks, process batch invoice generation, dispatch scheduled delivery notifications. |

---

## 5. Business Capabilities

```
+---------------------------------------------------------------------------------------+
|                                BookWorm Business Capabilities                         |
+---------------------------------------------------------------------------------------+
|  1. CUSTOMER IDENTITY & RELATIONSHIP MANAGEMENT                                       |
|     +-- Guest Session Management (Session Tokens)                                     |
|     +-- Authentication & Single Sign-On (JWT + bcryptjs)                              |
|     +-- Customer Profile & Address Book                                               |
|     +-- Customer Loyalty, Wallet & Gift Points                                        |
+---------------------------------------------------------------------------------------+
|  2. MERCHANDISING & CATALOG MANAGEMENT                                                |
|     +-- Multi-Level Category Taxonomy                                                 |
|     +-- Author, Publisher & Book Metadata Management                                  |
|     +-- Search, Faceted Navigation & Smart Filtering                                  |
|     +-- Personalized Recommendations & Recommendation Engine (History-based)          |
|     +-- Ratings, Reviews & Social Proof                                               |
+---------------------------------------------------------------------------------------+
|  3. COMMERCE & ORDER FULFILLMENT                                                      |
|     +-- Shopping Cart & Session Merging                                               |
|     +-- Promotions, Coupons & Discount Engine                                         |
|     +-- Order Management System (OMS) & Finite State Machine                          |
|     +-- Re-order ("Buy Again") Acceleration                                           |
|     +-- Returns & Order Cancellation Management                                       |
+---------------------------------------------------------------------------------------+
|  4. PAYMENTS & FINANCIAL SETTLEMENT                                                   |
|     +-- Mock Payment Gateway Simulation (Card, UPI, NetBanking, Wallets)              |
|     +-- Idempotent Payment Processing & Callback Webhooks                             |
|     +-- Automated & Manual Refund Processing                                          |
+---------------------------------------------------------------------------------------+
|  5. LOGISTICS & DELIVERY                                                              |
|     +-- Real-Time Shipping Rate Calculation                                           |
|     +-- Postal Zone & Estimated Delivery Date (EDD) Calculator                        |
|     +-- Carrier Integration, Tracking & Reverse Logistics                             |
+---------------------------------------------------------------------------------------+
```

---

## 6. Backend Modules & Node.js Express Architecture

The backend will be structured as a modular TypeScript + Express application adhering to **Layered & Clean Architecture** principles:

```
backend/
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/
│   ├── schema.prisma                 # Declarative data schema for PostgreSQL
│   ├── migrations/                   # Auto-generated SQL migrations
│   └── seed.ts                       # Seed data matching wireframe books & users
├── docs/
│   └── openapi/
│       └── openapi.yaml              # OpenAPI 3.0 specification contract
└── src/
    ├── app.ts                        # Express app initialization & middleware registration
    ├── server.ts                     # HTTP server entry point & graceful shutdown
    ├── config/                       # Environment variables, database, security config
    │   ├── env.config.ts
    │   └── prisma.client.ts
    ├── middlewares/                  # Express middleware
    │   ├── auth.middleware.ts        # JWT verification & RBAC guard
    │   ├── validate.middleware.ts    # Zod request schema validation
    │   ├── error.middleware.ts       # Global error handler & standard Problem Details
    │   ├── rateLimiter.middleware.ts # Express rate limiting
    │   └── logger.middleware.ts      # HTTP request logging (Morgan / Winston)
    ├── modules/
    │   ├── member/                   # Member & Auth Domain
    │   │   ├── member.controller.ts
    │   │   ├── member.routes.ts
    │   │   ├── member.service.ts
    │   │   └── member.schema.ts      # Zod validation schemas & TypeScript DTOs
    │   ├── catalog/                  # Catalog, Books, Authors, Categories, Reviews
    │   │   ├── catalog.controller.ts
    │   │   ├── catalog.routes.ts
    │   │   ├── catalog.service.ts
    │   │   └── catalog.schema.ts
    │   ├── cart/                     # Cart & Wishlist Domain
    │   │   ├── cart.controller.ts
    │   │   ├── cart.routes.ts
    │   │   ├── cart.service.ts
    │   │   └── cart.schema.ts
    │   ├── order/                    # Order Management & Checkout Domain
    │   │   ├── order.controller.ts
    │   │   ├── order.routes.ts
    │   │   ├── order.service.ts
    │   │   └── order.schema.ts
    │   ├── payment/                  # Payment & Mock Gateway Domain
    │   │   ├── payment.controller.ts
    │   │   ├── payment.routes.ts
    │   │   ├── payment.service.ts
    │   │   ├── payment.schema.ts
    │   │   └── adapters/             # Payment Gateway Adapters
    │   │       ├── payment-gateway.interface.ts
    │   │       └── mock-payment-gateway.adapter.ts
    │   └── shipping/                 # Shipping & Delivery Calculation Domain
    │       ├── shipping.controller.ts
    │       ├── shipping.routes.ts
    │       ├── shipping.service.ts
    │       └── shipping.schema.ts
    └── utils/                        # Shared helpers (logger, response formatters, crypto)
```

---

## 7. API Domains & Spec-Driven API Endpoints

All endpoints follow RESTful conventions, returning JSON payloads and standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`).

### 7.1 Authentication & Member Domain (`/api/v1/auth`, `/api/v1/members`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register a new customer account | No |
| `POST` | `/api/v1/auth/login` | Authenticate and issue JWT & refresh token | No |
| `POST` | `/api/v1/auth/refresh` | Rotate JWT using valid refresh token | No |
| `POST` | `/api/v1/auth/logout` | Invalidate current session/token | Yes |
| `GET` | `/api/v1/members/me` | Fetch authenticated user profile & addresses | Yes (`ROLE_CUSTOMER`) |
| `PUT` | `/api/v1/members/me` | Update customer profile details | Yes (`ROLE_CUSTOMER`) |
| `GET` | `/api/v1/members/me/addresses` | List saved shipping addresses | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/members/me/addresses` | Add a new shipping address | Yes (`ROLE_CUSTOMER`) |
| `DELETE` | `/api/v1/members/me/addresses/:id` | Remove a saved address | Yes (`ROLE_CUSTOMER`) |

### 7.2 Catalog & Discovery Domain (`/api/v1/catalog`, `/api/v1/categories`, `/api/v1/authors`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories` | Retrieve hierarchical category tree | No |
| `GET` | `/api/v1/catalog/books` | Search, filter, and paginate books (Category, Format, Price, Sort) | No |
| `GET` | `/api/v1/catalog/books/:id` | Get book details (PDP) with author, publisher, rating & pricing | No |
| `GET` | `/api/v1/catalog/featured` | Fetch curated sections (Recommended, Bestsellers, New Launches) | No |
| `GET` | `/api/v1/catalog/books/:id/related` | Get related cross-sell / up-sell books for a given book | No |
| `GET` | `/api/v1/authors/:id` | Get author profile and published book catalog | No |
| `GET` | `/api/v1/catalog/books/:id/reviews` | List paginated customer reviews and average rating | No |
| `POST` | `/api/v1/catalog/books/:id/reviews` | Submit star rating and review for a purchased book | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/catalog/books` | Create new book entry in catalog | Yes (`ROLE_CATALOG_ADMIN`) |
| `PUT` | `/api/v1/catalog/books/:id` | Update existing book details / stock | Yes (`ROLE_CATALOG_ADMIN`) |

### 7.3 Cart & Wishlist Domain (`/api/v1/cart`, `/api/v1/wishlist`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/cart` | Retrieve current cart items, counts, and cost breakdown | Optional (Guest/User) |
| `POST` | `/api/v1/cart/items` | Add book to shopping cart | Optional (Guest/User) |
| `PUT` | `/api/v1/cart/items/:itemId` | Update item quantity (+/-) | Optional (Guest/User) |
| `DELETE` | `/api/v1/cart/items/:itemId` | Remove specific item from cart | Optional (Guest/User) |
| `POST` | `/api/v1/cart/merge` | Merge guest session cart items into customer cart on login | Yes (`ROLE_CUSTOMER`) |
| `GET` | `/api/v1/wishlist` | Retrieve customer wishlist items | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/wishlist/items` | Add a book to wishlist | Yes (`ROLE_CUSTOMER`) |
| `DELETE` | `/api/v1/wishlist/items/:bookId` | Remove a book from wishlist | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/wishlist/move-to-cart/:bookId` | Move item directly from wishlist into active cart | Yes (`ROLE_CUSTOMER`) |

### 7.4 Order & Checkout Domain (`/api/v1/orders`, `/api/v1/coupons`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/orders/checkout/summary` | Calculate checkout preview (subtotal, taxes, shipping, discounts) | Yes / Guest |
| `POST` | `/api/v1/orders` | Create an immutable order from cart (with `Idempotency-Key`) | Yes (`ROLE_CUSTOMER`) |
| `GET` | `/api/v1/orders` | Get paginated user order history | Yes (`ROLE_CUSTOMER`) |
| `GET` | `/api/v1/orders/:orderId` | Get detailed order status, items, shipment & receipt | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/orders/:orderId/cancel` | Cancel order prior to shipment | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/orders/:orderId/return` | Initiate return request for eligible delivered order | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/orders/:orderId/buy-again` | Add previous order items into active cart for re-purchase | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/coupons/validate` | Validate coupon code against current cart | Yes / Guest |

### 7.5 Payment Domain (Mock Gateway) (`/api/v1/payments`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments/initiate` | Create mock payment session / intent for an order | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/payments/confirm` | Confirm mock payment with simulated card/UPI details | Yes (`ROLE_CUSTOMER`) |
| `POST` | `/api/v1/payments/simulate-webhook` | Simulate asynchronous payment webhook callback | No |
| `POST` | `/api/v1/payments/:paymentId/refund` | Trigger mock refund for cancelled or returned orders | Yes (`ROLE_STORE_ADMIN`) |

### 7.6 Shipping & Delivery Domain (`/api/v1/shipping`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/shipping/calculate-rate` | Calculate shipping cost based on pincode & cart weight | No |
| `GET` | `/api/v1/shipping/estimate-delivery` | Get estimated delivery date for a pincode & book SKU | No |
| `GET` | `/api/v1/shipping/track/:trackingNumber` | Retrieve shipment transit milestones | Yes / Guest |

---

## 8. Data Ownership Matrix & Entity Mapping

| Bounded Context | Aggregate Root / Entity | Primary DB Table | Read Ownership | Write Ownership |
| :--- | :--- | :--- | :--- | :--- |
| **Member** | `User`, `Address`, `Role` | `users`, `addresses`, `roles`, `user_roles` | Member, Order, Auth | Member Module Only |
| **Catalog** | `Book`, `Category`, `Author`, `Publisher`, `Review` | `books`, `categories`, `authors`, `publishers`, `reviews` | Catalog, Cart, Order | Catalog Module Only |
| **Cart** | `Cart`, `CartItem`, `Wishlist` | `carts`, `cart_items`, `wishlists`, `wishlist_items` | Cart, Order | Cart Module Only |
| **Order** | `Order`, `OrderItem`, `Coupon`, `OrderEvent` | `orders`, `order_items`, `coupons`, `order_status_history` | Order, Shipping, Member | Order Module Only |
| **Payment** | `PaymentTransaction`, `RefundTransaction` | `payment_transactions`, `refunds` | Payment, Order | Payment Module Only |
| **Shipping** | `Shipment`, `ShippingRateConfig`, `PincodeZone` | `shipments`, `shipping_rates`, `pincode_zones` | Shipping, Order | Shipping Module Only |

---

## 8.1 Detailed Relational Database Entity Schemas (PostgreSQL / Prisma)

### 1. Member & Identity Domain Tables

```
+----------------------------------------------------------------------------------------------------+
| TABLE: users                                                                                       |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| email                | VARCHAR(255)                | NOT NULL, UNIQUE, INDEX idx_users_email        |
| password_hash        | VARCHAR(255)                | NOT NULL (bcryptjs hash)                      |
| first_name           | VARCHAR(100)                | NOT NULL                                      |
| last_name            | VARCHAR(100)                | NOT NULL                                      |
| phone_number         | VARCHAR(20)                 | NULLABLE                                      |
| is_active            | BOOLEAN                     | NOT NULL, DEFAULT true                        |
| reward_points        | INTEGER                     | NOT NULL, DEFAULT 0                           |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| updated_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: roles                                                                                       |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | BIGSERIAL                   | PRIMARY KEY                                   |
| name                 | VARCHAR(50)                 | NOT NULL, UNIQUE (e.g., ROLE_CUSTOMER)        |
| description          | VARCHAR(255)                | NULLABLE                                      |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: user_roles (Join Table)                                                                     |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| user_id              | UUID                        | FK -> users(id) ON DELETE CASCADE             |
| role_id              | BIGINT                      | FK -> roles(id) ON DELETE CASCADE             |
| PRIMARY KEY(user_id, role_id)                                                                      |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: addresses                                                                                   |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| user_id              | UUID                        | FK -> users(id) ON DELETE CASCADE, INDEX      |
| recipient_name       | VARCHAR(150)                | NOT NULL                                      |
| phone_number         | VARCHAR(20)                 | NOT NULL                                      |
| address_line1        | VARCHAR(255)                | NOT NULL                                      |
| address_line2        | VARCHAR(255)                | NULLABLE                                      |
| city                 | VARCHAR(100)                | NOT NULL                                      |
| state                | VARCHAR(100)                | NOT NULL                                      |
| postal_code          | VARCHAR(20)                 | NOT NULL, INDEX idx_addresses_pincode         |
| country              | VARCHAR(100)                | NOT NULL, DEFAULT 'India'                     |
| is_default           | BOOLEAN                     | NOT NULL, DEFAULT false                       |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+
```

### 2. Catalog & Discovery Domain Tables

```
+----------------------------------------------------------------------------------------------------+
| TABLE: categories                                                                                  |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | BIGSERIAL                   | PRIMARY KEY                                   |
| name                 | VARCHAR(100)                | NOT NULL, UNIQUE (e.g., Non-Fiction, Romance) |
| slug                 | VARCHAR(120)                | NOT NULL, UNIQUE, INDEX idx_cat_slug          |
| parent_id            | BIGINT                      | NULLABLE, FK -> categories(id)                |
| display_order        | INTEGER                     | NOT NULL, DEFAULT 0                           |
| is_active            | BOOLEAN                     | NOT NULL, DEFAULT true                        |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: authors                                                                                     |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| name                 | VARCHAR(150)                | NOT NULL, INDEX idx_authors_name              |
| bio                  | TEXT                        | NULLABLE                                      |
| avatar_url           | VARCHAR(500)                | NULLABLE                                      |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: publishers                                                                                  |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| name                 | VARCHAR(150)                | NOT NULL, UNIQUE                              |
| description          | TEXT                        | NULLABLE                                      |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: books                                                                                       |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| title                | VARCHAR(255)                | NOT NULL, INDEX idx_books_title               |
| subtitle             | VARCHAR(255)                | NULLABLE                                      |
| isbn                 | VARCHAR(20)                 | NOT NULL, UNIQUE, INDEX idx_books_isbn        |
| author_id            | UUID                        | NOT NULL, FK -> authors(id), INDEX            |
| publisher_id         | UUID                        | NULLABLE, FK -> publishers(id)                |
| format               | VARCHAR(50)                 | NOT NULL (PAPERBACK, HARDCOVER, EBOOK)        |
| language             | VARCHAR(50)                 | NOT NULL, DEFAULT 'English'                   |
| description          | TEXT                        | NULLABLE                                      |
| front_cover_url      | VARCHAR(500)                | NOT NULL                                      |
| back_cover_url       | VARCHAR(500)                | NULLABLE                                      |
| price                | NUMERIC(10, 2)              | NOT NULL, CHECK (price >= 0)                  |
| list_price           | NUMERIC(10, 2)              | NULLABLE                                      |
| stock_quantity       | INTEGER                     | NOT NULL, DEFAULT 0, CHECK (stock_quantity>=0)|
| total_sales_count    | INTEGER                     | NOT NULL, DEFAULT 0, INDEX                    |
| average_rating       | NUMERIC(3, 2)               | NOT NULL, DEFAULT 0.00                        |
| review_count         | INTEGER                     | NOT NULL, DEFAULT 0                           |
| is_featured          | BOOLEAN                     | NOT NULL, DEFAULT false                       |
| is_bestseller        | BOOLEAN                     | NOT NULL, DEFAULT false                       |
| is_new_launch        | BOOLEAN                     | NOT NULL, DEFAULT false                       |
| publication_date     | DATE                        | NULLABLE                                      |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| updated_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: book_categories (Join Table)                                                                |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| book_id              | UUID                        | FK -> books(id) ON DELETE CASCADE             |
| category_id          | BIGINT                      | FK -> categories(id) ON DELETE CASCADE        |
| PRIMARY KEY(book_id, category_id)                                                                  |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: reviews                                                                                     |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| book_id              | UUID                        | NOT NULL, FK -> books(id), INDEX              |
| user_id              | UUID                        | NOT NULL, FK -> users(id), INDEX              |
| rating               | SMALLINT                    | NOT NULL, CHECK (rating BETWEEN 1 AND 5)      |
| reviewer_name        | VARCHAR(150)                | NOT NULL                                      |
| comment              | TEXT                        | NULLABLE                                      |
| is_verified_purchase | BOOLEAN                     | NOT NULL, DEFAULT false                       |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+
```

### 3. Cart & Wishlist Domain Tables

```
+----------------------------------------------------------------------------------------------------+
| TABLE: carts                                                                                       |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| user_id              | UUID                        | NULLABLE, FK -> users(id), UNIQUE             |
| session_token        | VARCHAR(255)                | NULLABLE, UNIQUE, INDEX idx_cart_session      |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| updated_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: cart_items                                                                                  |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| cart_id              | UUID                        | NOT NULL, FK -> carts(id) ON DELETE CASCADE   |
| book_id              | UUID                        | NOT NULL, FK -> books(id)                     |
| quantity             | INTEGER                     | NOT NULL, CHECK (quantity > 0)                |
| unit_price           | NUMERIC(10, 2)              | NOT NULL                                      |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| updated_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| UNIQUE(cart_id, book_id)                                                                           |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: wishlists                                                                                   |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| user_id              | UUID                        | NOT NULL, FK -> users(id) ON DELETE CASCADE   |
| book_id              | UUID                        | NOT NULL, FK -> books(id) ON DELETE CASCADE   |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| UNIQUE(user_id, book_id)                                                                           |
+----------------------------------------------------------------------------------------------------+
```

### 4. Order Management Domain Tables

```
+----------------------------------------------------------------------------------------------------+
| TABLE: coupons                                                                                     |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | BIGSERIAL                   | PRIMARY KEY                                   |
| code                 | VARCHAR(50)                 | NOT NULL, UNIQUE, INDEX idx_coupons_code      |
| discount_type        | VARCHAR(20)                 | NOT NULL (PERCENTAGE, FIXED_AMOUNT)           |
| discount_value       | NUMERIC(10, 2)              | NOT NULL, CHECK (discount_value > 0)          |
| min_order_amount     | NUMERIC(10, 2)              | NOT NULL, DEFAULT 0                           |
| max_discount_amount  | NUMERIC(10, 2)              | NULLABLE                                      |
| valid_from           | TIMESTAMP WITH TIME ZONE    | NOT NULL                                      |
| valid_until          | TIMESTAMP WITH TIME ZONE    | NOT NULL                                      |
| usage_limit          | INTEGER                     | NULLABLE                                      |
| times_used           | INTEGER                     | NOT NULL, DEFAULT 0                           |
| is_active            | BOOLEAN                     | NOT NULL, DEFAULT true                        |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: orders                                                                                      |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| order_number         | VARCHAR(32)                 | NOT NULL, UNIQUE, INDEX idx_orders_number     |
| user_id              | UUID                        | NULLABLE, FK -> users(id), INDEX              |
| guest_email          | VARCHAR(255)                | NULLABLE                                      |
| idempotency_key      | VARCHAR(100)                | NULLABLE, UNIQUE, INDEX                       |
| status               | VARCHAR(30)                 | NOT NULL (CREATED, CONFIRMED, SHIPPED, etc.)  |
| subtotal_amount      | NUMERIC(10, 2)              | NOT NULL, CHECK (subtotal_amount >= 0)        |
| tax_amount           | NUMERIC(10, 2)              | NOT NULL, DEFAULT 0.00                        |
| shipping_fee         | NUMERIC(10, 2)              | NOT NULL, DEFAULT 0.00                        |
| discount_amount      | NUMERIC(10, 2)              | NOT NULL, DEFAULT 0.00                        |
| total_amount         | NUMERIC(10, 2)              | NOT NULL, CHECK (total_amount >= 0)           |
| coupon_code          | VARCHAR(50)                 | NULLABLE                                      |
| points_redeemed      | INTEGER                     | NOT NULL, DEFAULT 0                           |
| shipping_address_json| JSONB                       | NOT NULL (Immutable address snapshot)         |
| estimated_delivery   | DATE                        | NOT NULL                                      |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| updated_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: order_items                                                                                 |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| order_id             | UUID                        | NOT NULL, FK -> orders(id) ON DELETE CASCADE  |
| book_id              | UUID                        | NOT NULL, FK -> books(id)                     |
| book_title           | VARCHAR(255)                | NOT NULL (Snapshot)                           |
| book_author          | VARCHAR(150)                | NOT NULL (Snapshot)                           |
| book_format          | VARCHAR(50)                 | NOT NULL (Snapshot)                           |
| cover_image_url      | VARCHAR(500)                | NOT NULL (Snapshot)                           |
| unit_price           | NUMERIC(10, 2)              | NOT NULL                                      |
| quantity             | INTEGER                     | NOT NULL, CHECK (quantity > 0)                |
| total_price          | NUMERIC(10, 2)              | NOT NULL                                      |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: order_status_history                                                                        |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | BIGSERIAL                   | PRIMARY KEY                                   |
| order_id             | UUID                        | NOT NULL, FK -> orders(id) ON DELETE CASCADE  |
| status               | VARCHAR(30)                 | NOT NULL                                      |
| comments             | VARCHAR(255)                | NULLABLE                                      |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+
```

### 5. Payment & Refund Domain Tables

```
+----------------------------------------------------------------------------------------------------+
| TABLE: payment_transactions                                                                        |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| order_id             | UUID                        | NOT NULL, FK -> orders(id), INDEX             |
| gateway_order_id     | VARCHAR(100)                | NOT NULL, INDEX                               |
| gateway_payment_id   | VARCHAR(100)                | NULLABLE, UNIQUE, INDEX                       |
| payment_method       | VARCHAR(30)                 | NOT NULL (CREDIT_CARD, DEBIT_CARD, UPI, WALLET)|
| amount               | NUMERIC(10, 2)              | NOT NULL                                      |
| currency             | VARCHAR(3)                  | NOT NULL, DEFAULT 'INR'                       |
| status               | VARCHAR(30)                 | NOT NULL (PENDING, SUCCESS, FAILED, REFUNDED) |
| gateway_response_raw | JSONB                       | NULLABLE (Audit trail)                        |
| error_message        | VARCHAR(255)                | NULLABLE                                      |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| updated_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: refunds                                                                                     |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| payment_id           | UUID                        | NOT NULL, FK -> payment_transactions(id)      |
| order_id             | UUID                        | NOT NULL, FK -> orders(id)                    |
| refund_amount        | NUMERIC(10, 2)              | NOT NULL, CHECK (refund_amount > 0)           |
| gateway_refund_id    | VARCHAR(100)                | NULLABLE, UNIQUE                              |
| reason               | VARCHAR(255)                | NOT NULL                                      |
| status               | VARCHAR(30)                 | NOT NULL (INITIATED, PROCESSED, FAILED)       |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+
```

### 6. Shipping & Delivery Domain Tables

```
+----------------------------------------------------------------------------------------------------+
| TABLE: pincode_zones                                                                               |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | BIGSERIAL                   | PRIMARY KEY                                   |
| postal_pincode       | VARCHAR(10)                 | NOT NULL, UNIQUE, INDEX                       |
| city                 | VARCHAR(100)                | NOT NULL                                      |
| state                | VARCHAR(100)                | NOT NULL                                      |
| zone_code            | VARCHAR(20)                 | NOT NULL (LOCAL, REGIONAL, NATIONAL, METRO)   |
| standard_edd_days    | INTEGER                     | NOT NULL, DEFAULT 4                           |
| express_edd_days     | INTEGER                     | NOT NULL, DEFAULT 1                           |
| is_servicable        | BOOLEAN                     | NOT NULL, DEFAULT true                        |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: shipping_rates                                                                              |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | BIGSERIAL                   | PRIMARY KEY                                   |
| zone_code            | VARCHAR(20)                 | NOT NULL                                      |
| shipping_tier        | VARCHAR(20)                 | NOT NULL (STANDARD, EXPRESS)                  |
| base_rate            | NUMERIC(10, 2)              | NOT NULL                                      |
| free_shipping_threshold NUMERIC(10, 2)             | NOT NULL, DEFAULT 499.00                      |
| per_kg_rate          | NUMERIC(10, 2)              | NOT NULL, DEFAULT 0.00                        |
+----------------------+-----------------------------+-----------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| TABLE: shipments                                                                                   |
+----------------------+-----------------------------+-----------------------------------------------+
| Column               | Type                        | Constraints / Description                     |
+----------------------+-----------------------------+-----------------------------------------------+
| id                   | UUID                        | PRIMARY KEY, DEFAULT gen_random_uuid()        |
| order_id             | UUID                        | NOT NULL, FK -> orders(id), UNIQUE            |
| carrier_name         | VARCHAR(100)                | NOT NULL (BlueDart, Delhivery, Fedex)         |
| tracking_number      | VARCHAR(100)                | NOT NULL, UNIQUE, INDEX                       |
| shipping_status      | VARCHAR(30)                 | NOT NULL (MANIFESTED, IN_TRANSIT, DELIVERED)  |
| dispatched_at        | TIMESTAMP WITH TIME ZONE    | NULLABLE                                      |
| estimated_delivery   | DATE                        | NOT NULL                                      |
| delivered_at         | TIMESTAMP WITH TIME ZONE    | NULLABLE                                      |
| created_at           | TIMESTAMP WITH TIME ZONE    | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
+----------------------+-----------------------------+-----------------------------------------------+
```

---

## 9. Out of Scope Items & Architectural Boundaries

To maintain focus on the core requirements depicted in the wireframes and architecture diagrams, the following capabilities are explicitly classified as **Out of Scope** for initial delivery:

1. **Multi-Vendor Marketplace Settlement:** Third-party merchant onboardings, split vendor payouts, vendor commission calculations, or individual vendor portals are excluded. All inventory is managed under single store / catalog administration.
2. **Production External Payment Gateway Live Integration:** Live payment network integration with physical bank gateways is mocked; mock gateway simulation covers all user stories and test paths.
3. **Physical POS (Point-of-Sale) Integration:** Hardware integrations (barcode scanners at physical store registers, receipt printers) are excluded.
4. **Complex Warehouse Management Systems (WMS):** Multi-warehouse rack/bin routing, automated forklift sorting, or 3PL robotic pick-and-pack workflows are excluded. Shipping rates and delivery time estimation are computed via rule-based postal zone matrices.
5. **Real-time Live Chat / Video Customer Support:** Video consultations, live video streaming, or peer-to-peer chat are excluded. Standard review feedback forms are supported.
6. **Dynamic LLM / Real-time Generative AI on PDP:** High-cost real-time AI agents generating live book summaries on-the-fly are excluded; recommendations are driven by deterministic category affinities, purchase co-occurrence, and sales rank queries.

---

## 10. Spec-Driven Implementation Roadmap & Sub-Tasks (Node.js + Express)

The following structured implementation sub-tasks are ready for phased execution once approved.

### Sub-Task 1: OpenAPI 3.0 Contract & Specification Definition
- **Intent:** Define comprehensive, mockable OpenAPI 3.0 contracts covering all 6 domains before writing backend code.
- **Expected Outcomes:** Complete `openapi.yaml` specifications created in `docs/openapi/`, validating request/response schemas, query parameters, error contracts, and security schemes.
- **Todo List:**
  1. Draft Member & Auth API specifications.
  2. Draft Catalog, Books, Authors, Categories & Reviews API specifications.
  3. Draft Cart, Wishlist & Promotions API specifications.
  4. Draft Order Management & Checkout API specifications.
  5. Draft Mock Payment & Refund Gateway API specifications.
  6. Draft Shipping Rate & Estimated Delivery Date API specifications.
- **Status:** `[x] completed`

### Sub-Task 2: Node.js + Express Project Scaffolding & Prisma Migrations
- **Intent:** Initialize Node.js + Express + TypeScript project (`package.json`, `tsconfig.json`), configure dependencies (`express`, `@prisma/client`, `zod`, `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `winston`, `swagger-ui-express`), setup Prisma schema, and author versioned database migrations.
- **Expected Outcomes:** Bootstrappable Express application connecting to PostgreSQL via Prisma Client with initialized database tables and seed data.
- **Todo List:**
  1. Initialize `package.json` with scripts (`dev`, `build`, `start`, `test`, `prisma:migrate`, `prisma:seed`).
  2. Setup `tsconfig.json` and Express `app.ts` / `server.ts` boilerplate.
  3. Author `prisma/schema.prisma` matching all entity tables defined in Section 8.1.
  4. Run initial Prisma migration creating PostgreSQL tables.
  5. Author `prisma/seed.ts` with initial mock book catalog matching wireframe images (Joy of Minimalism, The Art of Focus, etc.).
- **Status:** `[x] completed`

### Sub-Task 3: Security & Member Management Implementation
- **Intent:** Implement stateless JWT authentication, `bcryptjs` password hashing, RBAC middleware, and user profile/address endpoints.
- **Expected Outcomes:** Working `/api/v1/auth/*` and `/api/v1/members/*` endpoints returning valid JWTs and protecting role-restricted routes.
- **Todo List:**
  1. Implement `member.schema.ts` (Zod schemas for registration, login, profile, and address management).
  2. Build `auth.middleware.ts` for JWT verification and role checking (`requireRole`).
  3. Implement `member.service.ts` and `member.controller.ts`.
  4. Register `/api/v1/auth` and `/api/v1/members` routes in Express.
- **Status:** `[x] completed`

### Sub-Task 4: Catalog & Product Discovery Service Implementation
- **Intent:** Implement book catalog browsing, full-text search, multi-faceted filtering (category, author, format, price range), PDP details, and review submission.
- **Expected Outcomes:** Fully functional Catalog APIs matching wireframes (Image 1, 2, 3) including curated segments (Recommended, Bestsellers, New Launches, Related Reads).
- **Todo List:**
  1. Implement `catalog.schema.ts` with query filter validation schemas.
  2. Implement `catalog.service.ts` with dynamic Prisma filtering, pagination, and sorting.
  3. Implement curated sections (Featured, Bestsellers, New Launches, Related Reads).
  4. Build Review submission and rating aggregation logic.
  5. Register `/api/v1/catalog`, `/api/v1/categories`, and `/api/v1/authors` routes.
- **Status:** `[x] completed`

### Sub-Task 5: Cart & Wishlist Service Implementation
- **Intent:** Build shopping cart and wishlist management with guest session token support and login cart merge logic.
- **Expected Outcomes:** Functional cart management supporting quantity updates, real-time pricing recalculations, and wishlist transfers.
- **Todo List:**
  1. Implement `cart.schema.ts` for cart additions, quantity updates, and wishlist actions.
  2. Implement `cart.service.ts` supporting guest session tokens (`x-guest-session-id`) and authenticated customer carts.
  3. Build cart merging logic to synchronize guest cart items upon login.
  4. Implement `wishlist.service.ts` with move-to-cart capabilities.
  5. Register `/api/v1/cart` and `/api/v1/wishlist` routes.
- **Status:** `[x] completed`

### Sub-Task 6: Order Lifecycle & Checkout Engine Implementation
- **Intent:** Implement checkout calculation engine, coupon discount verification, immutable order placement, state transitions, and "Buy Again" feature.
- **Expected Outcomes:** Complete order placement flow matching wireframe Image 4 & 6 with transactional safety and idempotency.
- **Todo List:**
  1. Implement `order.schema.ts` for checkout preview and order creation.
  2. Build checkout calculation service for subtotals, taxes, shipping, and coupons.
  3. Implement idempotent order creation within Prisma interactive transactions (`prisma.$transaction`).
  4. Implement order history, cancellation, and "Buy Again" logic.
  5. Register `/api/v1/orders` and `/api/v1/coupons` routes.
- **Status:** `[x] completed`

### Sub-Task 7: Mock Payment Gateway Implementation & Processing Engine
- **Intent:** Implement a robust Mock Payment Gateway adapter supporting multi-method payments (Credit/Debit Card, UPI, Wallet) with deterministic success/failure simulation, webhook callbacks, and instant refund simulation.
- **Expected Outcomes:** Complete mock payment orchestration supporting wireframe Image 5 (Payment Modal) and Image 6 (Purchase Confirmation) with transaction reference generation and order state transitions to `CONFIRMED`.
- **Todo List:**
  1. Define `PaymentGatewayAdapter` interface (`initiatePayment`, `verifyPayment`, `processRefund`).
  2. Implement `MockPaymentGatewayAdapter` with configurable latency, deterministic test card/UPI rules (Success, Decline, Insufficient Funds), and mock transaction token generation.
  3. Implement `payment.service.ts` and `payment.controller.ts`.
  4. Expose `/api/v1/payments/initiate`, `/api/v1/payments/confirm`, `/api/v1/payments/simulate-webhook`, and `/api/v1/payments/:paymentId/refund`.
  5. Connect successful mock payment verification to Order state transition (`CONFIRMED`) and inventory deduction.
- **Status:** `[x] completed`

### Sub-Task 8: Shipping, Delivery Estimation & Rate Calculator
- **Intent:** Implement postal zone lookup, dynamic shipping cost estimation, and estimated delivery date (EDD) calculations.
- **Expected Outcomes:** Shipping APIs returning realistic delivery dates and charges across PDP, cart, and checkout.
- **Todo List:**
  1. Implement `shipping.schema.ts` and `shipping.service.ts`.
  2. Build EDD calculation logic based on shipping tier and postal destination.
  3. Expose `/api/v1/shipping/calculate-rate`, `/api/v1/shipping/estimate-delivery`, and `/api/v1/shipping/track/:trackingNumber`.
  4. Register shipping routes in Express.
- **Status:** `[x] completed`

### Sub-Task 9: Integration Testing, OpenAPI Validation & Documentation
- **Intent:** Verify all endpoints against the OpenAPI contract with end-to-end integration tests using Jest & Supertest and Swagger UI documentation.
- **Expected Outcomes:** Comprehensive test suite passing with $>80\%$ coverage and interactive Swagger UI accessible at `/api-docs`.
- **Todo List:**
  1. Write Jest + Supertest integration tests for customer purchase journey (Auth $\rightarrow$ Browse $\rightarrow$ Cart $\rightarrow$ Checkout $\rightarrow$ Mock Payment $\rightarrow$ Confirmation).
  2. Validate OpenAPI schema compliance across all endpoints.
  3. Mount `swagger-ui-express` serving `docs/openapi/openapi.yaml` at `/api-docs`.
- **Status:** `[x] completed`

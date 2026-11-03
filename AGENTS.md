# BookWorm E-Commerce Backend — AGENTS.md

## Project Overview
**BookWorm** is an online bookstore e-commerce platform backend providing RESTful APIs for catalog discovery, personalized book recommendations, shopping carts, wishlist management, checkout orchestration, mock payment processing, order lifecycle tracking, and shipping rate calculations.

## Tech Stack
- **Runtime & Language:** Node.js (v20+ LTS), TypeScript (strict mode)
- **Framework:** Express.js (modular layered architecture)
- **Database & ORM:** PostgreSQL, Prisma ORM with versioned migrations
- **Validation:** Zod for request payloads, query parameters, and route parameters
- **Authentication:** Stateless JWT (`jsonwebtoken`), `bcryptjs` password hashing, RBAC middleware
- **Security:** Helmet, CORS, Express Rate Limit
- **API Specification:** OpenAPI 3.0 (`docs/openapi/openapi.yaml`) served via `swagger-ui-express`
- **Testing:** Jest, Supertest

## Directory Structure
```
capstone-backend/
├── AGENTS.md                         # Project-wide onboarding context for Bob
├── backend-architecture-plan.md      # Approved architectural & process specification
├── .bob/                             # Bob rules and mode-specific instructions
│   ├── rules/
│   │   └── basic_rules.md
│   ├── rules-agent/
│   │   └── AGENTS-agent.md
│   ├── rules-plan/
│   │   └── AGENTS-plan.md
│   └── rules-ask/
│       └── AGENTS-ask.md
├── docs/
│   ├── architecture.png              # System architecture diagram
│   ├── wireframes/                   # UI wireframes (Images 1-6)
│   ├── local-database-setup-guide.md # Extra developer guide: local PostgreSQL & DBeaver
│   └── openapi/
│       └── openapi.yaml              # OpenAPI 3.0 specification contract
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts
    └── src/
        ├── app.ts
        ├── server.ts
        ├── config/
        ├── middlewares/
        ├── modules/
        │   ├── member/
        │   ├── catalog/
        │   ├── cart/
        │   ├── order/
        │   ├── payment/
        │   └── shipping/
        └── utils/
```

## Architectural Conventions & Rules
1. **Spec-Driven Development:** OpenAPI contract specifications in `docs/openapi/openapi.yaml` serve as the single source of truth for all API models, status codes, and query contracts.
2. **Layered Module Architecture:** Each domain module inside `backend/src/modules/<domain>/` contains:
   - `<domain>.routes.ts`: Route definitions and middleware binding
   - `<domain>.controller.ts`: HTTP request/response handling and status codes
   - `<domain>.service.ts`: Business logic and Prisma database operations
   - `<domain>.schema.ts`: Zod validation schemas and inferred TypeScript types
3. **Mock Payment Gateway:** Payment processing uses the adapter pattern (`PaymentGatewayAdapter` and `MockPaymentGatewayAdapter`) supporting deterministic test card/UPI scenarios without external network dependencies.
4. **Idempotency & Transactions:** Critical write operations (Order creation, inventory deduction, payment confirmation) must enforce idempotency keys and execute inside Prisma interactive transactions (`prisma.$transaction`).
5. **Standardized Error Handling:** All API error responses follow RFC 7807 Problem Details format (`{ status, title, detail, errors, timestamp }`).

# Agent Mode Context — BookWorm Backend

## Implementation Strategy
When working in **Agent Mode**:
1. Implement one sub-task at a time following the roadmap in `backend-architecture-plan.md`.
2. Follow strict TypeScript types and Zod request validation for all controllers.
3. Keep domain logic inside service layers (`<domain>.service.ts`) and maintain clean controller separation.
4. Ensure all database operations use Prisma ORM and manage transactions appropriately.
5. Use `MockPaymentGatewayAdapter` for all payment and refund transactions.
6. Verify code changes with Jest/Supertest integration tests before marking tasks completed.

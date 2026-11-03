# Plan Mode Context — BookWorm Backend

## Focus & Principles
In **Plan Mode**, focus on high-level architecture, domain boundaries, OpenAPI contract design, data modeling, and structured implementation sequencing.

## Guidelines
- Never modify backend production code or execute implementation tasks directly while in Plan Mode.
- Reference the approved architecture specification in `backend-architecture-plan.md`.
- Keep changes minimal and aligned with the wireframes in `docs/wireframes/` and system architecture in `docs/architecture.png`.
- Ensure all planned features follow the Spec-Driven Development workflow (OpenAPI contract first $\rightarrow$ Prisma schema $\rightarrow$ Express routes $\rightarrow$ Tests).

# syntax=docker/dockerfile:1
# Build context MUST be the repository root (the API loads docs/openapi/openapi.yaml at startup):
#   docker build -f backend/Dockerfile -t bookworm-backend .

# ---------- build stage ----------
FROM node:20-bookworm-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/tests ./tests
# Compiles to dist/src/server.js (prisma generate + tsc)
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app/backend

# Layout must mirror the repo: openapi.ts walks up from dist/src/config to find docs/openapi/openapi.yaml
COPY --from=build --chown=node:node /app/backend/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
# Prisma schema + migrations (schema path is configured in package.json) needed by `prisma migrate deploy`
COPY --from=build --chown=node:node /app/backend/tests/prisma ./tests/prisma
COPY --chown=node:node docs/openapi /app/docs/openapi

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations, then start. exec keeps node as PID 1 so SIGTERM triggers graceful shutdown.
CMD ["sh", "-c", "npm run prisma:deploy && exec node dist/src/server.js"]

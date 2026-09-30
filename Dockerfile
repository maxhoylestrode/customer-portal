# ---- build the React/Vite client ----
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- build the Express/TypeScript server ----
FROM node:22-slim AS server-build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM node:22-slim
# Prisma's query engine needs libssl, which the slim image doesn't ship
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server

# `prisma` is a runtime dependency (not dev) so `migrate deploy` below uses the
# lockfile's pinned CLI instead of npx fetching whatever version is latest
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/prisma ./prisma
RUN npx prisma generate

COPY --from=server-build /app/server/dist ./dist
COPY server/scripts ./scripts
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "node scripts/prepare-db.js && npx prisma migrate deploy && node dist/index.js"]

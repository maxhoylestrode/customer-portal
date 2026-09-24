# ---- build the React/Vite client ----
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- build the Express/TypeScript server ----
FROM node:22-slim AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM node:22-slim
WORKDIR /app/server

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/prisma ./prisma
RUN npx prisma generate

COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

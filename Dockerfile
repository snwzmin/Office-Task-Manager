FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends git bash && \
    rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /build

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/office-tasks/package.json artifacts/office-tasks/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @workspace/office-tasks run build

RUN mkdir -p artifacts/api-server/public && \
    cp -r artifacts/office-tasks/dist/public/. artifacts/api-server/public/

RUN pnpm --filter @workspace/api-server run build

RUN node_modules/.bin/esbuild seed.mjs \
      --bundle --platform=node --format=esm \
      --outfile=seed.bundle.mjs --external:*.node

RUN node_modules/.bin/esbuild migrate.mjs \
      --bundle --platform=node --format=esm \
      --outfile=migrate.bundle.mjs --external:*.node

FROM node:20-alpine AS runner

RUN apk add --no-cache bash

ENV NODE_ENV=production
ENV PORT=8080
ENV UPLOAD_DIR=/app/uploads

WORKDIR /app

COPY --from=builder /build/artifacts/api-server/dist ./dist
COPY --from=builder /build/artifacts/api-server/public ./public
COPY --from=builder /build/seed.bundle.mjs ./seed.mjs
COPY --from=builder /build/migrate.bundle.mjs ./migrate.mjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/uploads

EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]

# Production image — compiles TypeScript in the builder, then runs
# `node dist/src/index.js` (not ts-node). Dokploy must use this file,
# not Dockerfile.dev.
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# Lighter compile for Docker (no source maps) on memory-constrained VPS
RUN yarn exec tsc -p tsconfig.build.json

FROM node:22-alpine AS production

WORKDIR /app

RUN corepack enable

ENV NODE_ENV=production

COPY package.json yarn.lock ./

# Runtime image: skip devDependencies (eslint, jest, ts-node, etc.)
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle

RUN mkdir -p uploads

RUN apk add --no-cache wget

EXPOSE 5006

CMD ["node", "dist/src/index.js"]

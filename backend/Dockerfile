# Production Dockerfile — multi-stage, low memory footprint for small VPS (Dokploy)
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# Lighter compile for Docker (no source maps) on memory-constrained VPS
RUN yarn exec tsc -p tsconfig.build.json

FROM node:20-alpine AS production

WORKDIR /app

RUN corepack enable

ENV NODE_ENV=production

COPY package.json yarn.lock ./

# Runtime image: skip devDependencies (eslint, jest, ts-node, etc.)
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads

EXPOSE 3005

CMD ["node", "dist/src/index.js"]

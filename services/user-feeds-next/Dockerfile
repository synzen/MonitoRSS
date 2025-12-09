# Production Dockerfile
FROM oven/bun:1 AS base

WORKDIR /usr/src/app

# Install dependencies (production only)
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Final production image using Alpine
FROM oven/bun:1-alpine AS release
WORKDIR /usr/src/app
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY . .

# Set production environment
ENV NODE_ENV=production

# Run with optimizations
CMD ["bun", "run", "start"]

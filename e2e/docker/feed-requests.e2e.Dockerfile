# E2E-only feed-requests image. The regular services/feed-requests Dockerfile
# resolves @monitorss/contracts from npm, but ADR-011's `force` field is not
# published yet: the npm package fails `npm run build` (missing type) and its
# Zod schema strips `force` at runtime. Building from the repo root puts the
# workspace link in play so the local package is consumed, and running via tsx
# (like the dev stack) skips the tsc typecheck that would still fail.
FROM node:24

# Node.js uses its own CA bundle; add system certs for sites like apps.usfa.fema.gov
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/contracts packages/contracts
COPY packages/logger packages/logger
COPY services/feed-requests services/feed-requests

RUN npm install --workspace packages/contracts --workspace packages/logger \
    --workspace services/feed-requests && \
    npm run build --workspace packages/logger --workspace packages/contracts

CMD ["npm", "run", "start:watch", "--workspace", "services/feed-requests"]

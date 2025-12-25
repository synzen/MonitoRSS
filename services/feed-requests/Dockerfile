FROM node:22 AS build

# Node.js uses its own CA bundle; add system certs for sites like apps.usfa.fema.gov
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . ./

RUN npm run build

# There seems to be a bug where nest build completes before it actually finishes building
RUN sleep 1

FROM build AS build-prod

WORKDIR /usr/src/app
COPY --from=build /usr/src/app ./

RUN apt install curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh

RUN npm prune --production
RUN /usr/local/bin/node-prune

FROM node:22-slim AS prod

# Slim image doesn't include CA certs; install them for sites like apps.usfa.fema.gov
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

WORKDIR /usr/src/app

COPY --from=build-prod /usr/src/app/package*.json ./
COPY --from=build-prod /usr/src/app/node_modules node_modules
COPY --from=build-prod /usr/src/app/dist dist

CMD [ "node", "./dist/main" ]

FROM node:16 AS build

WORKDIR /usr/src/app

COPY package*.json ./
COPY client/package*.json client/

RUN npm install && cd client && npm install

COPY . ./

FROM node:16 AS build-prod

WORKDIR /usr/src/app
COPY --from=build /usr/src/app ./

# Build production files
ENV SKIP_PREFLIGHT_CHECK=true
RUN npm run build && cd client && npm run build

RUN apt install curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh

RUN npm prune --production
RUN /usr/local/bin/node-prune

# Alpine will cause the app to mysteriously exit when attempting to register @fastify/secure-session
FROM node:16-slim AS prod

WORKDIR /usr/src/app

COPY --from=build-prod /usr/src/app/package*.json ./
COPY --from=build-prod /usr/src/app/node_modules node_modules
COPY --from=build-prod /usr/src/app/dist dist
COPY --from=build-prod /usr/src/app/client/dist client/dist

ENV PORT=3000
HEALTHCHECK --interval=5s --timeout=5s --retries=3 CMD wget http://localhost:3000/api/v1/health -q -O - > /dev/null 2>&1

CMD [ "node", "./dist/main" ]

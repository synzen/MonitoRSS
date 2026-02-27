FROM node:24 AS build
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . ./

FROM node:24 AS build-prod
WORKDIR /usr/src/app
COPY --from=build /usr/src/app ./

RUN npm run build

RUN npm prune --production

# Alpine will cause the app to mysteriously exit when attempting to register @fastify/secure-session
FROM node:24-slim AS prod

RUN apt-get update && apt-get install -y wget
WORKDIR /usr/src/app

COPY --from=build-prod /usr/src/app/package*.json ./
COPY --from=build-prod /usr/src/app/node_modules node_modules
COPY --from=build-prod /usr/src/app/dist dist

ENV BACKEND_API_PORT=3000

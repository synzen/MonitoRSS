FROM node:22 AS build
WORKDIR /usr/src/app

COPY package*.json ./
COPY client/package*.json client/

RUN npm install && cd client && npm install

COPY . ./

FROM node:22 AS build-prod


ARG VITE_FRESHDESK_WIDGET_ID
ARG VITE_PADDLE_PW_AUTH
ARG VITE_SENTRY_DSN
ARG VITE_PADDLE_CLIENT_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_RELEASE

WORKDIR /usr/src/app
COPY --from=build /usr/src/app ./

# Build production files
ENV SKIP_PREFLIGHT_CHECK=true
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_FRESHDESK_WIDGET_ID=$VITE_FRESHDESK_WIDGET_ID
ENV VITE_PADDLE_PW_AUTH=$VITE_PADDLE_PW_AUTH
ENV VITE_PADDLE_CLIENT_TOKEN=$VITE_PADDLE_CLIENT_TOKEN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ENV SENTRY_RELEASE=$SENTRY_RELEASE

RUN npm run build && cd client && npm run build

RUN apt install curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh

RUN npm prune --production
# RUN /usr/local/bin/node-prune

# Alpine will cause the app to mysteriously exit when attempting to register @fastify/secure-session
FROM node:22-slim AS prod

RUN apt-get update && apt-get install -y wget
WORKDIR /usr/src/app

COPY --from=build-prod /usr/src/app/package*.json ./
COPY --from=build-prod /usr/src/app/node_modules node_modules
COPY --from=build-prod /usr/src/app/dist dist
COPY --from=build-prod /usr/src/app/client/dist client/dist

ENV BACKEND_API_PORT=3000


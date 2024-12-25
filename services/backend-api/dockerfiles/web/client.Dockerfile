FROM node:22 AS build
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . ./

# Alpine will cause the app to mysteriously exit when attempting to register @fastify/secure-session
FROM node:22-slim  AS prod

ARG VITE_FRESHDESK_WIDGET_ID
ARG VITE_PADDLE_PW_AUTH
ARG VITE_PADDLE_CLIENT_TOKEN

RUN apt install curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh

ENV VITE_FRESHDESK_WIDGET_ID=$VITE_FRESHDESK_WIDGET_ID
ENV VITE_PADDLE_PW_AUTH=$VITE_PADDLE_PW_AUTH
ENV VITE_PADDLE_CLIENT_TOKEN=$VITE_PADDLE_CLIENT_TOKEN

RUN npm run build

RUN npm prune --production
RUN /usr/local/bin/node-prune

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/node_modules node_modules
COPY --from=build /usr/src/app/dist dist

ENV BACKEND_API_PORT=3000
HEALTHCHECK --interval=5s --timeout=10s --retries=3 CMD wget http://localhost:3000 -q -O - > /dev/null 2>&1

CMD [ "node", "./dist/main" ]

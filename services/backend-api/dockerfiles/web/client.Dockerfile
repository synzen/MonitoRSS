FROM node:18 AS build
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . ./

ARG VITE_PADDLE_SELLER_ID
ARG VITE_FRESHDESK_WIDGET_ID

RUN apt install curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh

ENV VITE_PADDLE_SELLER_ID=$VITE_PADDLE_SELLER_ID
ENV VITE_FRESHDESK_WIDGET_ID=$VITE_FRESHDESK_WIDGET_ID

RUN npm run build

RUN npm prune --production
RUN /usr/local/bin/node-prune

# Alpine will cause the app to mysteriously exit when attempting to register @fastify/secure-session
FROM node:18-slim  AS prod

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/node_modules node_modules
COPY --from=build /usr/src/app/dist dist

ENV BACKEND_API_PORT=3000
HEALTHCHECK --interval=5s --timeout=10s --retries=3 CMD wget http://localhost:3000 -q -O - > /dev/null 2>&1

CMD [ "node", "./dist/main" ]

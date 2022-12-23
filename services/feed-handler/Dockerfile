FROM node:16 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . ./

RUN npm run build

FROM node:16-alpine AS prod


WORKDIR /usr/src/app

COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/node_modules node_modules
COPY --from=build /usr/src/app/dist dist

RUN npm prune --production

ENV FEED_HANDLER_API_PORT=3000
HEALTHCHECK --interval=5s --timeout=5s --retries=3 CMD wget http://localhost:3000/cep/v0/health -q -O - > /dev/null 2>&1

CMD [ "node", "./dist/main" ]

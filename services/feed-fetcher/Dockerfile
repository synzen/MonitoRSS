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

ENV FEED_FETCHER_API_PORT=3000

CMD [ "node", "./dist/main" ]

FROM node:20 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . ./

FROM node:20 AS build-prod

WORKDIR /usr/src/app
COPY --from=build /usr/src/app ./

RUN npm run build

RUN apt install curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh

RUN npm prune --production
RUN /usr/local/bin/node-prune

FROM node:20-alpine AS prod

WORKDIR /usr/src/app

COPY --from=build-prod /usr/src/app/package*.json ./
COPY --from=build-prod /usr/src/app/node_modules node_modules
COPY --from=build-prod /usr/src/app/dist dist

CMD [ "node", "./dist/main" ]

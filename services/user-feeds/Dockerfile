FROM node:22 AS build

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

RUN npm prune --production

FROM node:22-alpine AS prod

WORKDIR /usr/src/app

COPY --from=build-prod /usr/src/app/package*.json ./
COPY --from=build-prod /usr/src/app/node_modules node_modules
COPY --from=build-prod /usr/src/app/dist dist

CMD [ "node", "./dist/main" ]

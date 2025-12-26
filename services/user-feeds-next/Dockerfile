FROM node:22 AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build

FROM build AS build-prod
WORKDIR /usr/src/app
COPY --from=build /usr/src/app ./
RUN apt install curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh
RUN npm prune --production
RUN /usr/local/bin/node-prune

FROM node:22-alpine AS prod
WORKDIR /usr/src/app
COPY --from=build-prod /usr/src/app/package*.json ./
COPY --from=build-prod /usr/src/app/node_modules node_modules
COPY --from=build-prod /usr/src/app/dist dist
ENV NODE_ENV=production
CMD [ "node", "./dist/index.js" ]

FROM node:16 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . ./

# Build production files
FROM node:16-alpine AS prod

RUN apt install curl
RUN curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | bash -s -- -b /usr/local/bin

RUN npm run build

RUN npm prune --production
RUN /usr/local/bin/node-prune

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/node_modules node_modules
COPY --from=build /usr/src/app/dist dist

ENV PORT=8000
HEALTHCHECK --interval=5s --timeout=5s --retries=3 CMD wget http://localhost:8000/api/v1/health -q -O - > /dev/null 2>&1

CMD [ "node", "./dist/main" ]

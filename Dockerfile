FROM node:alpine
RUN mkdir -p /app/node_modules && \
    chown -R node:node /app
WORKDIR /app
COPY package*.json ./
COPY --chown=node:node web/package*.json web/
USER node
RUN npm install
COPY . .
ENV DRSS_BOT_TOKEN='drss_docker_token' DRSS_DATABASE_URI='mongodb://mongo:27017/rss' DRSS_WEB_PORT=8080
CMD ["node", "server.js"]

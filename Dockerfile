FROM node:alpine
WORKDIR /usr/src/discord-rss
COPY package*.json ./
RUN npm install
COPY . .
ENV DRSS_BOT_TOKEN='drss_docker_token' DRSS_MONGODB_URI='mongodb://mongo/rss'
CMD ["node", "server.js"]

FROM node:alpine
WORKDIR /usr/src/discord-rss
COPY package*.json ./
RUN npm install
COPY . .
ENV DRSS_BOT_TOKEN='drss_docker_token' DRSS_DATABASE_URI='mongodb://mongo:27017/rss'
CMD ["node", "server.js"]

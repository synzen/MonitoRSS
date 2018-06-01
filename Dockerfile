FROM node:latest
WORKDIR /usr/src/discord-rss
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "server.js"]
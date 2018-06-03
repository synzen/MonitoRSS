FROM node:alpine
WORKDIR /usr/src/discord-rss
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "server.js"]

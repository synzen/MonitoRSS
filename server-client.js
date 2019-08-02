// Create a single client

const DiscordRSS = require('./src/index.js')
const drss = new DiscordRSS.Client() // Override default config values here

drss.login(require('./src/config.js').bot.token, true)

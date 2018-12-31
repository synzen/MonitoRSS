// Create a single client

const DiscordRSS = require('./index.js')
const drss = new DiscordRSS.Client() // Override default config values here

drss.login(require('./config.js').bot.token, true)

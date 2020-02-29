// Create a single client

const DiscordRSS = require('./src/index.js')
const path = require('path')

const drss = new DiscordRSS.Client()

drss.login(require(path.join(__dirname, 'src', 'config.js')).bot.token)

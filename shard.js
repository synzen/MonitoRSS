const DiscordRSS = require('./index.js')
const passedConfig = JSON.parse(process.env.DRSS_CONFIG)
const config = require('./src/config.js').set(passedConfig)

const drss = new DiscordRSS.Client()

drss.login(config.bot.token)

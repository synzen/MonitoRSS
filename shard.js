const MonitoRSS = require('./index.js')
const passedConfig = JSON.parse(process.env.DRSS_CONFIG)
const config = require('./src/config.js').set(passedConfig)

const client = new MonitoRSS.Client()

client.login(config.bot.token)

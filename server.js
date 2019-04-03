// This logic that stems from this file will automatically create a sharding manager and shards if necessary, if the original client cannot handle the number of guilds

const DiscordRSS = require('./index.js')
const config = require('./config.js')

const drss = new DiscordRSS.Client({ readFileSchedules: true, setPresence: true })
let token = config.bot.token

try {
  const override = require('./settings/configOverride.json')
  token = override.bot && override.bot.token ? override.bot.token : token
} catch (err) {}

drss.once('finishInit', () => {
  try {
    if (config.web.enabled === true) require('./web/index.js')()
  } catch (err) {
    console.log(err)
  }
})

drss.login(token)

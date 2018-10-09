const DiscordRSS = require('./index.js')
const config = require('./config.json')

const drss = new DiscordRSS.Client({ readFileSchedules: true, setPresence: true })
let token = process.env.DRSS_DISCORD_TOKEN || config.bot.token
//DRSS_DISCORD_TOKEN is intended for use by Heroku

try {
  const override = require('./settings/configOverride.json')
  token = override.bot && override.bot.token ? override.bot.token : token
} catch (err) {}

drss.login(token)

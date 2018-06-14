const DiscordRSS = require('./index.js')
const config = require('./config.json')

const drss = new DiscordRSS.Client({ readFileSchedules: true, setPresence: true })
let token = config.bot.token

try {
  const override = require('./settings/configOverride.json')
  token = override ? override.bot.token : token
} catch (err) {}

drss.login(token)

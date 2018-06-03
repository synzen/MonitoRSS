const DiscordRSS = require('./index.js')
const config = require('./config.json')

const drss = new DiscordRSS.Client({ readFileSchedules: true, setPresence: true })
drss.login(config.bot.token)

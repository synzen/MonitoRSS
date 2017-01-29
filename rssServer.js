const Discord = require('discord.js')
const bot = new Discord.Client()
const eventHandler = (evnt) => require(`./events/${evnt}.js`)
const initRSS = require('./util/initFeeds.js')
const config = require('./config.json')

bot.on('ready', function() {
  console.log("Discord.RSS RSS functions are now online.")
  initRSS(bot)
  bot.removeAllListeners('ready')
})

bot.login(config.token)

process.on("unhandledRejection", (err, promise) => {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err);
})

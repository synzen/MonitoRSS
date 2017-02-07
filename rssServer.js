const Discord = require('discord.js')
const bot = new Discord.Client()
const initRSS = require('./util/initFeeds.js')
const config = require('./config.json')

if (config.logDates) require('./util/logDates.js')();

bot.on('ready', function() {
  console.log("I am online.")
  initRSS(bot)
  bot.removeAllListeners('ready')
})

bot.login(config.token)

process.on("unhandledRejection", (err, promise) => {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err);
})

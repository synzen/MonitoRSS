const Discord = require('discord.js')
const bot = new Discord.Client()
const eventHandler = (evnt) => require(`./events/${evnt}.js`)
const rssConfig = require('./config.json')
const startRSSInit = require('./util/initFeeds.js')

bot.on('ready', function() {
  console.log("I am online.")
  startRSSInit(bot)
  bot.removeAllListeners('ready')
})

bot.on('message', function (message) {
  eventHandler('message')(bot, message)
})

bot.on('guildCreate', function (guild) {
  eventHandler('guildCreate')(bot, guild)
})

bot.on('guildDelete', function (guild) {
  eventHandler('guildDelete')(bot, guild)
})

bot.on('channelDelete', function (channel) {
  eventHandler('channelDelete')(channel)
})


bot.login(rssConfig.token)

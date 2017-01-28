const Discord = require('discord.js')
const bot = new Discord.Client()
const eventHandler = (evnt) => require(`./events/${evnt}.js`)
const config = require('./config.json')

bot.on('ready', function() {
  console.log("I am online.")
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

bot.on('roleDelete', function (role) {
  eventHandler('roleDelete')(bot, role)
})

bot.login(config.token)

process.on("unhandledRejection", (err, promise) => {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err);
})

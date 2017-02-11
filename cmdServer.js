const Discord = require('discord.js')
const bot = new Discord.Client()
const eventHandler = (evnt) => require(`./events/${evnt}.js`)
const config = require('./config.json')
const fileOps = require('./util/updateJSON.js')

if (config.logging.logDates) require('./util/logDates.js')();

(function login() {
  bot.login(config.botSettings.token).catch(err => {
    console.log(`Discord.RSS commands module could not login, retrying...`)
    setTimeout(login, 1000)
  })
})()

bot.on('ready', function() {
  console.log("Discord.RSS commands module activated and online.")
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
  if (!fileOps.exists(`./sources/${channel.guild.id}.json`)) return;
  eventHandler('channelDelete')(channel)
})

bot.on('roleUpdate', function (oldRole, newRole) {
  if (oldRole.name === newRole.name || !fileOps.exists(`./sources/${oldRole.guild.id}.json`)) return;
  eventHandler('roleUpdate')(bot, oldRole, newRole)
})

bot.on('roleDelete', function (role) {
  eventHandler('roleDelete')(bot, role)
})

bot.on('guildUpdate', function (oldGuild, newGuild) {
  if (newGuild.name === oldGuild.name || !fileOps.exists(`./sources/${oldGuild.id}.json`)) return;
  eventHandler('guildUpdate')(bot, oldGuild, newGuild)
})


process.on("unhandledRejection", function (err, promise) {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err);
})

process.on('uncaughtException', function (err) {
  console.log(`Fatal Error for Commands Module! Stopping bot, printing error:\n\n`, err.stack)
  process.send('kill')
  process.exit(1)
})

process.on('message', function (message) {
  if (message === 'kill') process.exit(1);
})

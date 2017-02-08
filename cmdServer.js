const Discord = require('discord.js')
const bot = new Discord.Client()
const eventHandler = (evnt) => require(`./events/${evnt}.js`)
const config = require('./config.json')
const fileOps = require('./util/updateJSON.js')

if (config.logDates) require('./util/logDates.js')();

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
  eventHandler('channelDelete')(channel)
})

bot.on('roleUpdate', function (oldRole, newRole) {
  if (oldRole.name === newRole.name) return;
  eventHandler('roleUpdate')(bot, oldRole, newRole)
})

bot.on('roleDelete', function (role) {
  eventHandler('roleDelete')(bot, role)
})

bot.on('guildUpdate', function (oldGuild, newGuild) {
  if (newGuild.name === oldGuild.name || !fileOps.exists(`./sources/${oldGuild.id}.json`)) return;
  eventHandler('guildUpdate')(bot, oldGuild, newGuild)
})

bot.login(config.token)

process.on("unhandledRejection", (err, promise) => {
  console.log('Unhandled Rejection at: Promise', promise, 'reason:', err);
})

process.on('message', function (guildFile) {
  try {
    delete require.cache[require.resolve(`./sources/${guildFile}.json`)];
    console.log("Discord Commands Module now using new and updated file for guild ID: " + guildFile);
  } catch (e) {}
})

const fs = require('fs')
const config = require('../config.json')
const sqlCmds = require('../rss/sql/commands.js')
const fileOps = require('../util/fileOps.js')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/guildStorage.js').currentGuilds

module.exports = function (bot, guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been removed.`)

  for (var channelId in channelTracker.activeCollectors) {
    if(guild.channels[channelId]) delete channelTracker.activeCollectors[channelId];
  }

  if (!fs.existsSync(`./sources/${guild.id}.json`)) return;

  const rssList = currentGuilds.get(guild.id).sources

  for (var rssName in rssList) {
    sqlCmds.dropTable(config.feedManagement.databaseName, rssName)
  }

  fileOps.deleteFile(guild.id, function() {
    console.log(`RSS Info: Guild profile ${guild.id}.json (${guild.name}) deleted from sources folder.`)
  })

  if (!config.logging.discordChannelLog) return;

  const logChannelId = config.logging.discordChannelLog
  const logChannel = bot.channels.get(config.logging.discordChannelLog)
  if (typeof logChannelId !== "string" || !logChannel) console.log(`Error: Could not log guild removal to Discord, invalid channel ID.`);
  else logChannel.sendMessage(`Guild Info: "${guild.name}" has been removed.\nUsers: ${guild.members.size}`).catch(err => console.log(`Could not log guild removal to Discord. (${err}) `));
}

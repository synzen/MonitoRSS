const config = require('../config.json')
const sqlCmds = require('../rss/sql/commands.js')
const fileOps = require('../util/fileOps.js')
const channelTracker = require('../util/channelTracker.js')

module.exports = function (bot, guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been removed.`)

  for (var channelId in channelTracker.activeCollectors) {
    if(guild.channels[channelId]) delete channelTracker.activeCollectors[channelId];
  }

  if (!fileOps.exists(`./sources/${guild.id}.json`)) return;
  else var rssList = require(`../sources/${guild.id}.json`).sources;

  for (let rssName in rssList) {
    sqlCmds.dropTable(config.feedManagement.databaseName, rssName, function() {})
  }

  fileOps.deleteFile(guild.id, `../sources/${guild.id}.json`, function() {
    console.log(`RSS Info: Guild entry ${guild.id} (${guild.name}) deleted.`)
  })

  if (!config.logging.discordChannelLog) return;

  let logChannelId = config.logging.discordChannelLog
  let logChannel = bot.channels.get(config.logging.discordChannelLog)
  if (typeof logChannelId !== "string" || !logChannel) console.log(`Error: Could not log guild removal to Discord, invalid channel ID.`);
  else logChannel.sendMessage(`Guild Info: "${guild.name}" has been removed.\nUsers: ${guild.members.size}`).catch(err => console.log(`Could not log guild removal to Discord, reason: `, err));
}

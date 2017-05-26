const checkGuild = require('../util/checkGuild.js')
const currentGuilds = require('../util/storage.js').currentGuilds

module.exports = function (bot, oldRole, newRole) {
  const guildRss = currentGuilds.get(oldRole.guild.id)
  if (!guildRss.sources) return
  const rssList = guildRss.sources

  for (var rssName in rssList) {
    checkGuild.roles(bot, oldRole.guild.id, rssName)
  }
}

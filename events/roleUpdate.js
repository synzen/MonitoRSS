const fileOps = require('../util/fileOps.js')
const checkGuild = require('../util/checkGuild.js')

module.exports = function (bot, oldRole, newRole) {
  var guildRss = require(`../sources/${oldRole.guild.id}.json`)
  var rssList = guildRss.sources

  for (var rssName in rssList) {
    checkGuild.roles(bot, oldRole.guild.id, rssName);
  }

}

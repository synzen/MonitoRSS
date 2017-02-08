const fileOps = require('../util/updateJSON.js')
const checkGuild = require('../util/checkGuild.js')

module.exports = function (bot, oldRole, newRole) {
  var guildRss = require(`../sources/${oldRole.guild.id}.json`)
  var rssList = guildRss.sources

  for (var rssIndex in rssList) {
    checkGuild.roles(bot, oldRole.guild.id, rssIndex);
  }

}

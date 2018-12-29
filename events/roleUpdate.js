const checkGuild = require('../util/checkGuild.js')
const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')

module.exports = (bot, oldRole, newRole) => {
  dbOps.guildRss.get(oldRole.guild.id).then(guildRss => {
    if (!guildRss) return
    checkGuild.subscriptions(bot, guildRss)
  }).catch(err => log.general.warning('Unable get guild profile after role update', oldRole.guild, err))
}

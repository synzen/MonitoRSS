const dbOps = require('../util/dbOps.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const log = require('../util/logger.js')

module.exports = (bot, oldGuild, newGuild) => {
  if (!currentGuilds.get(oldGuild.id)) return
  const guildRss = currentGuilds.get(oldGuild.id)
  if (guildRss.name === newGuild.name) return
  guildRss.name = newGuild.name
  dbOps.guildRss.update(guildRss).catch(err => log.general.warning(`Could not update guild after name change`, newGuild, err))
}

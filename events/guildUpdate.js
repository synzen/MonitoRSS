const dbOps = require('../util/dbOps.js')
const redisOps = require('../util/redisOps.js')
const log = require('../util/logger.js')

module.exports = async (oldGuild, newGuild) => {
  redisOps.guilds.update(oldGuild, newGuild).catch(err => log.general.error(`Redis failed to update after guildUpdate event`, newGuild, err))
  try {
    const guildRss = await dbOps.guildRss.get(oldGuild.id)
    if (!guildRss || guildRss.name === newGuild.name) return
    guildRss.name = newGuild.name
    await dbOps.guildRss.update(guildRss)
  } catch (err) {
    log.general.warning(`Could not update guild after name change event`, newGuild, err)
  }
}

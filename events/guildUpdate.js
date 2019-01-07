const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')

module.exports = async (oldGuild, newGuild) => {
  try {
    const guildRss = await dbOps.guildRss.get(oldGuild.id)
    if (!guildRss || guildRss.name === newGuild.name) return
    guildRss.name = newGuild.name
    await dbOps.guildRss.update(guildRss)
  } catch (err) {
    log.general.warning(`Could not update guild after name change event`, newGuild, err)
  }
}

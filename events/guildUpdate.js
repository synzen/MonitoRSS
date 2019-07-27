const dbOpsGuilds = require('../util/db/guilds.js')
const log = require('../util/logger.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')

module.exports = async (oldGuild, newGuild) => {
  RedisGuild.utils.update(oldGuild, newGuild).catch(err => log.general.error(`Redis failed to update after guildUpdate event`, newGuild, err))
  try {
    const guildRss = await dbOpsGuilds.get(oldGuild.id)
    if (!guildRss || guildRss.name === newGuild.name) return
    guildRss.name = newGuild.name
    await dbOpsGuilds.update(guildRss)
  } catch (err) {
    log.general.warning(`Could not update guild after name change event`, newGuild, err)
  }
}

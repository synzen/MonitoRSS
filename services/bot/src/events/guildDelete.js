const GuildData = require('../structs/GuildData.js')
const createLogger = require('../util/logger/create.js')

module.exports = async guild => {
  const log = createLogger(guild.shard.id)
  log.info({ guild }, `Guild (Members: ${guild.memberCount}) has been removed`)
  try {
    const guildData = await GuildData.get(guild.id)
    await guildData.delete()
  } catch (err) {
    log.warn({
      error: err,
      guild
    }, 'Failed to remove data of guild')
  }
}

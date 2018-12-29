const storage = require('../../util/storage.js')
const config = require('../../config.js')
const log = require('../../util/logger.js')
const dbOps = require('../../util/dbOps.js')

exports.normal = async (bot, message) => {
  const overrides = storage.limitOverrides
  try {
    const guildRssList = await dbOps.guildRss.getAll()
    const illegals = []
    guildRssList.forEach(guildRss => {
      const guildId = guildRss.id
      const guildSourcesCnt = Object.keys(guildRss.sources).length
      const guildLimit = overrides[guildId] ? overrides[guildId] : config.feeds.max
      if (guildSourcesCnt > guildLimit) illegals.push(guildId)
    })

    if (illegals.length === 0) await message.channel.send(`Everything looks good!`)
    else await message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``)
  } catch (err) {
    log.controller.warning('checklimits', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('checklimits 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

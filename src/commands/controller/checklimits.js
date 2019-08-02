const log = require('../../util/logger.js')
const dbOps = require('../../util/dbOps.js')
const serverLimit = require('../../util/serverLimit.js')

exports.normal = async (bot, message) => {
  try {
    const allVips = await dbOps.vips.getAll()
    const guildRssList = await dbOps.guildRss.getAll()
    const illegals = []
    guildRssList.forEach(guildRss => {
      const { max } = serverLimit(guildRss.id, allVips)
      let activeFeeds = 0
      const rssList = guildRss.sources
      if (rssList) {
        for (const rssName in rssList) {
          if (!rssList[rssName].disabled) ++activeFeeds
        }
      }
      if (activeFeeds > max) illegals.push(guildRss.id)
    })

    if (illegals.length === 0) await message.channel.send(`Everything looks good!`)
    else await message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``)
  } catch (err) {
    log.controller.warning('checklimits', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('checklimits 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

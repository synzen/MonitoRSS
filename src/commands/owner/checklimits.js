const log = require('../../util/logger.js')
const config = require('../../config.js')
const Feed = require('../../structs/db/Feed.js')
const Supporter = require('../../structs/db/Supporter.js')

module.exports = async (bot, message) => {
  try {
    const supporters = await Supporter.getValidSupporters()
    const supporterLimits = new Map()
    for (const supporter of supporters) {
      const limit = await supporter.getMaxFeeds()
      const guilds = supporter.guilds
      for (const id of guilds) {
        supporterLimits.set(id, limit)
      }
    }

    const illegals = []
    const guildIds = bot.guilds.cache.keyArray()
    const promises = []
    for (const id of guildIds) {
      promises.push(Feed.getBy('guild', id))
    }

    /** @type {Array<Feed[]>} */
    const results = (await Promise.all(promises))
    for (let i = 0; i < guildIds.length; ++i) {
      const guildId = guildIds[i]
      const guildFeeds = results[i].filter(feed => !feed.disabled)
      const limit = supporterLimits.get(guildId) || config.feeds.max
      if (guildFeeds.length > limit) {
        illegals.push(guildId)
      }
    }

    if (illegals.length === 0) {
      await message.channel.send(`Everything looks good!`)
    } else {
      await message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``)
    }
  } catch (err) {
    log.owner.warning('checklimits', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('checklimits 1a', message.guild, err))
  }
}

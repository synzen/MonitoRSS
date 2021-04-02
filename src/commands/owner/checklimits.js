const Feed = require('../../structs/db/Feed.js')
const Guild = require('../../structs/Guild.js')
const getConfig = require('../../config.js').get

module.exports = async (message) => {
  const supporterLimits = await Guild.getAllUniqueFeedLimits()
  const config = getConfig()

  const illegals = []
  const guildIds = message.client.guilds.cache.keyArray()
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
    await message.channel.send('Everything looks good!')
  } else {
    await message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``)
  }
}

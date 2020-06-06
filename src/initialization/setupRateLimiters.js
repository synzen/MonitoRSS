const Supporter = require('../structs/db/Supporter.js')
const Feed = require('../structs/db/Feed.js')
const ArticleMessageRateLimiter = require('../structs/ArticleMessageRateLimiter.js')

/**
 * @param {import('discord.js').Client} bot
 */
async function setupRateLimiters (bot) {
  const guilds = bot.guilds.cache.keyArray()
  const feeds = await Feed.getManyByQuery({
    guild: {
      $in: guilds
    }
  })
  const supporterGuilds = new Set(await Supporter.getValidGuilds())
  for (var i = feeds.length - 1; i >= 0; --i) {
    const feed = feeds[i]
    const channel = bot.channels.cache.get(feed.channel)
    if (!channel) {
      continue
    }
    const isSupporter = supporterGuilds.has(channel.guild.id)
    if (!ArticleMessageRateLimiter.hasLimiter(feed.channel)) {
      ArticleMessageRateLimiter.create(feed.channel, isSupporter)
    }
  }
}

module.exports = setupRateLimiters

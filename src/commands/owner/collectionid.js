const Feed = require('../../structs/db/Feed.js')
const ArticleModel = require('../../models/Article.js')
const log = require('../../util/logger.js')

async function getFeed (bot, message) {
  const args = message.content.split(' ')
  const feedID = args[1]
  if (!feedID) {
    return null
  }
  const feed = await Feed.get(feedID)
  if (!feed) {
    return null
  }
  return feed
}

module.exports = async (bot, message) => {
  try {
    const feed = await getFeed(bot, message)
    if (!feed) {
      return await message.channel.send('No such feed found.')
    }
    const guild = feed.guild
    const schedule = await feed.determineSchedule()
    const res = await bot.shard.broadcastEval(`
      const guild = this.guilds.get('${guild}');
      guild ? this.shard.id : null
    `)
    const shard = res.find(result => result !== null)
    if (shard === undefined) {
      return await message.channel.send(`Guild ${guild} was not found within the bot.`)
    }
    await message.channel.send(ArticleModel.getCollectionID(feed.url, shard, schedule.name))
  } catch (err) {
    log.owner.warning('collectionid sharded', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('collectionid 2a', message.guild, err))
  }
}

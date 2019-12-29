const AssignedSchedule = require('../../structs/db/AssignedSchedule.js')
const ArticleModel = require('../../models/Article.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  try {
    const args = message.content.split(' ')
    const feedID = args[1]
    if (!feedID) {
      return await message.channel.send('No feed ID argument')
    }
    const assigned = await AssignedSchedule.getByFeedAndShard(feedID, -1)
    if (!assigned) {
      return await message.channel.send('No assigned schedule')
    }
    const link = assigned.link
    const shardID = assigned.shard
    const scheduleName = assigned.schedule
    await message.channel.send(ArticleModel.getCollectionID(link, shardID, scheduleName))
  } catch (err) {
    log.owner.warning('collectionid', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('collectionid 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

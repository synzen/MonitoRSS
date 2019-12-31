const Feed = require('../../structs/db/Feed.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const feedID = content[1]
  try {
    const feed = await Feed.get(feedID)
    if (!feed) {
      return await message.channel.send(`Could not find any feeds with that id.`)
    }
    return await message.channel.send(`Found guild ${feed.guild}`)
  } catch (err) {
    log.owner.warning('feedguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('checklimits 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

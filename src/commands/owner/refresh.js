const FeedFetcher = require('../../util/FeedFetcher.js')
const log = require('../../util/logger.js')
const FailCounter = require('../../structs/db/FailCounter.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]

  try {
    if (FailCounter.limit === 0) {
      return await message.channel.send(`No fail limit has been set.`)
    }
    const counter = await FailCounter.getBy('url', link)
    if (!counter || !counter.hasFailed()) {
      return await message.channel.send('That is not a failed link.')
    }

    await FeedFetcher.fetchURL(link)
    await counter.delete()
    log.owner.info(`Link ${link} has been refreshed and will be back on cycle.`, message.author)
    await message.channel.send(`Successfully refreshed <${link}>.`)
  } catch (err) {
    log.owner.warning('refresh', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('refresh 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

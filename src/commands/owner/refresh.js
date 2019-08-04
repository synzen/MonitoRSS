const config = require('../../config.js')
const FeedFetcher = require('../../util/FeedFetcher.js')
const log = require('../../util/logger.js')
const dbOpsFailedLinks = require('../../util/db/failedLinks.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]

  try {
    if (config.feeds.failLimit === 0) return await message.channel.send(`No fail limit has been set.`)
    const failedLinkStatus = await dbOpsFailedLinks.get(link)
    if (!failedLinkStatus || !failedLinkStatus.failed) return await message.channel.send('That is not a failed link.')

    await FeedFetcher.fetchURL(link)
    await dbOpsFailedLinks.reset(link)
    log.owner.info(`Link ${link} has been refreshed and will be back on cycle.`, message.author)
    await message.channel.send(`Successfully refreshed <${link}>.`)
  } catch (err) {
    log.owner.warning('refresh', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('refresh 1a', message.guild, err))
  }
}

exports.sharded = exports.normal

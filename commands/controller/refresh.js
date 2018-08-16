const config = require('../../config.json')
const storage = require('../../util/storage.js')
const requestStream = require('../../rss/request.js')
const log = require('../../util/logger.js')
const dbOps = require('../../util/dbOps.js')

exports.normal = async (bot, message) => {
  const failedLinks = storage.failedLinks
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]

  try {
    if (config.feeds.failLimit === 0) return await message.channel.send(`No fail limit has been set.`)
    if (typeof failedLinks[link] !== 'string') return await message.channel.send('That is not a failed link.')

    await requestStream(link)
    await dbOps.failedLinks.reset(link)
    log.controller.info(`Link ${link} has been refreshed and will be back on cycle.`, message.author)
    await message.channel.send(`Successfully refreshed <${link}>.`)
  } catch (err) {
    log.controller.warning('refresh', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('refresh 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message, Manager) => {
  const failedLinks = storage.failedLinks

  const content = message.content.split(' ')
  if (content.length !== 2) return
  const link = content[1]
  try {
    if (config.feeds.failLimit === 0) return await message.channel.send(`No fail limit has been set.`)
    if (typeof failedLinks[link] !== 'string') return await message.channel.send('That is not a failed link.')

    await requestStream(link)
    await bot.shard.broadcastEval(`delete require(require('path').dirname(require.main.filename) + '/util/storage.js').failedLinks['${link}'];`)
    await dbOps.failedLinks.reset(link)
    log.controller.info(`Link ${link} has been refreshed and will be back on cycle.`, message.author)
    await message.channel.send(`Successfully refreshed <${link}>.`)
  } catch (err) {
    log.controller.warning('refresh', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('refresh 1b', message.guild, err))
  }
}

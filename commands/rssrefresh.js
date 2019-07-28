const config = require('../config.js')
const log = require('../util/logger.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const channelTracker = require('../util/channelTracker.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const FAIL_LIMIT = config.feeds.failLimit

module.exports = async (bot, message, command) => {
  try {
    if (FAIL_LIMIT === 0) return await message.channel.send(`No fail limit has been set.`)
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const rssList = guildRss.sources
    if (!rssList || Object.keys(rssList).length === 0) return await message.channel.send('There are no failed feeds.')
    let toRefresh = []
    channelTracker.add(message.channel.id)
    for (const rssName in rssList) {
      const source = rssList[rssName]
      const failedLinkStatus = await dbOpsFailedLinks.get(source.link)
      if (!failedLinkStatus || !failedLinkStatus.failed) continue
      toRefresh.push(source.link)
    }
    if (toRefresh.length === 0) {
      channelTracker.remove(message.channel.id)
      return await message.channel.send('There are no failed feeds to refresh.')
    }
    const processing = await message.channel.send(`Processing requests for refresh...`)
    let failedReasons = {}
    for (const link of toRefresh) {
      log.command.info(`Attempting to refresh ${link}`, message.guild)
      try {
        await FeedFetcher.fetchURL(link)
        await dbOpsFailedLinks.reset(link)
        log.command.info(`Refreshed ${link} and is back on cycle`, message.guild)
      } catch (err) {
        failedReasons[link] = err.message
      }
    }

    let successfulLinks = ''
    let failedLinks = ''
    for (const link of toRefresh) {
      if (!failedReasons[link]) successfulLinks += `${link}\n`
      else failedLinks += `${link} (${failedReasons[link]})`
    }

    let reply = ''
    if (successfulLinks) reply += 'The following links have successfully been refreshed:\n```' + successfulLinks + '```\n\n'
    if (failedLinks) reply += 'The following links failed to refresh:\n```' + failedLinks + '```'
    channelTracker.remove(message.channel.id)
    await processing.edit(reply)
  } catch (err) {
    log.command.warning(`rssrefresh`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssrefresh 1', message.guild, err))
  }
}

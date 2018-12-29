const config = require('../config.js')
const log = require('../util/logger.js')
const requestStream = require('../rss/request.js')
const dbOps = require('../util/dbOps.js')
const FeedSelector = require('../structs/FeedSelector.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FAIL_LIMIT = config.feeds.failLimit

module.exports = async (bot, message, command) => {
  try {
    if (FAIL_LIMIT === 0) return await message.channel.send(`No fail limit has been set.`)
    const guildRss = await dbOps.guildRss.get(message.guild.id)
    const feedSelector = new FeedSelector(message, null, { command: command }, guildRss)
    const data = await new MenuUtils.MenuSeries(message, [feedSelector]).start()
    if (!data) return
    const { rssName } = data
    const source = guildRss.sources[rssName]
    const failedLinkStatus = await dbOps.failedLinks.get(source.link)

    if (!failedLinkStatus || !failedLinkStatus.failed) return await message.channel.send(`There is no need to refresh the feed <${source.link}> if it has not reached the failure limit.`)

    const cookies = (source.advanced && source.advanced.cookies && Object.keys(source.advanced).length > 0) ? source.advanced.cookies : undefined
    const processing = await message.channel.send(`Processing request for refresh...`)

    log.command.info(`Attempting to refresh ${source.link}`, message.guild)
    try {
      await requestStream(source.link, cookies)
      await dbOps.failedLinks.reset(source.link)
      log.command.info(`Refreshed ${source.link} and is back on cycle`, message.guild)
    } catch (err) {
      log.command.info(`Unable to refresh ${source.link}`, message.guild, err)
      return await message.channel.send(`Unable to refresh <${source.link}>.\n\n${err.message}`)
    }
    await processing.edit(`Successfully refreshed <${source.link}>. It will now be retrieved on subsequent cycles.`)
  } catch (err) {
    log.command.warning(`rssrefresh`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssrefresh 1', message.guild, err))
  }
}

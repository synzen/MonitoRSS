const config = require('../config.json')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const failedLinks = storage.failedLinks
const requestStream = require('../rss/request.js')
const FeedSelector = require('./util/FeedSelector.js')
const FAIL_LIMIT = config.feedSettings.failLimit

function feedSelectorFn (m, data, callback) {
  callback(null, data)
}

module.exports = (bot, message, command) => {
  if (FAIL_LIMIT === 0) return message.channel.send(`No fail limit has been set.`)
  if (Object.keys(failedLinks).length === 0) return message.channel.send(`There are no feeds that have exceeded the fail limit.`)

  new FeedSelector(message, feedSelectorFn, { command: command }).send(null, async (err, data, msgHandler) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { guildRss, rssName } = data
      if (!rssName) return
      const source = guildRss.sources[rssName]

      if (!failedLinks[source.link] || failedLinks[source.link] < FAIL_LIMIT) {
        msgHandler.deleteAll(message.channel)
        return await message.channel.send(`There is no need to refresh the feed <${source.link}> if it has not reached the failure limit.`)
      }

      const cookies = (source.advanced && source.advanced.cookies && Object.keys(source.advanced).length > 0) ? source.advanced.cookies : undefined
      const processing = await message.channel.send(`Processing request for refresh...`)

      requestStream(source.link, cookies, null, err => {
        if (err) {
          log.command.warning(`Unable to refresh feed link ${source.link}`, message.guild, err)
          return processing.edit(`Unable to refresh feed ${source.link}. Reason:\`\`\`${err.message || err}\n\`\`\``).catch(err => log.command.warning(`rssrefresh 1`, message.guild, err))
        }
        delete failedLinks[source.link]
        if (bot.shard) process.send({ type: 'updateFailedLinks', failedLinks: failedLinks })
        log.command.info(`Refreshed ${source.link} and is back on cycle`, message.guild)
        msgHandler.deleteAll(message.channel)
        processing.edit(`Successfully refreshed <${source.link}>. It will now be retrieved on subsequent cycles.`).catch(err => log.command.warning(`rssrefresh 2`, message.guild, err))
      })
    } catch (err) {
      log.command.warning(`rssrefresh`, message.guild, err)
    }
  })
}

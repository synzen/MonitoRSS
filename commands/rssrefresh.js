const config = require('../config.json')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const requestStream = require('../rss/request.js')
const dbOps = require('../util/dbOps.js')
const FeedSelector = require('../structs/FeedSelector.js')
const FAIL_LIMIT = config.feeds.failLimit

function feedSelectorFn (m, data, callback) {
  callback(null, data)
}

module.exports = (bot, message, command) => {
  if (FAIL_LIMIT === 0) return message.channel.send(`No fail limit has been set.`)
  const failedLinks = storage.failedLinks

  if (Object.keys(failedLinks).length === 0) return message.channel.send(`There are no feeds that have exceeded the fail limit.`)

  new FeedSelector(message, feedSelectorFn, { command: command }).send(null, async (err, data, msgHandler) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { guildRss, rssName } = data
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
        dbOps.failedLinks.reset(source.link, err => {
          if (err) {
            processing.edit(`Unable to refresh <${source.link}> due to internal error.`).catch(err => log.command.warning(`rssrefresh 2a`, message.guild, err))
            return log.command.error(`Unable to refresh link ${source.link} via rssrefresh`, message.guild, err)
          }
          log.command.info(`Refreshed ${source.link} and is back on cycle`, message.guild)
          msgHandler.deleteAll(message.channel)
          processing.edit(`Successfully refreshed <${source.link}>. It will now be retrieved on subsequent cycles.`).catch(err => log.command.warning(`rssrefresh 2b`, message.guild, err))
        })
      })
    } catch (err) {
      log.command.warning(`rssrefresh`, message.guild, err)
    }
  })
}

const fs = require('fs')
const config = require('../config.json')
const storage = require('../util/storage.js')
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
          console.log(`Commands Info: Unable to refresh feed link ${source.link}, reason: `, err.message || err)
          console.info(err.message)
          console.info(err)
          return processing.edit(`Unable to refresh feed ${source.link}. Reason:\`\`\`${err.message || err}\n\`\`\``)
        }
        delete failedLinks[source.link]

        if (bot.shard) bot.shard.broadcastEval(`delete require(require('path').dirname(require.main.filename) + '/util/storage.js').failedLinks['${source.link}'];`).catch(err => console.log(`Error: Unable to broadcast failed links update on rssrefresh:`, err.message || err))

        try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Error: Unable to update failedLinks.json from rssrefresh:`, e.message || e) }

        console.log(`RSS Info: Link ${source.link} has been refreshed back on cycle.`)
        msgHandler.deleteAll(message.channel)
        processing.edit(`Successfully refreshed <${source.link}>. It will now be retrieved on subsequent cycles.`).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rssrefresh 1`, err.message || err))
      })
    } catch (err) {
      console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rssrefresh:`, err.message || err)
    }
  })
}

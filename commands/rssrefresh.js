const fs = require('fs')
const config = require('../config.json')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const failedLinks = storage.failedLinks
const requestStream = require('../rss/request.js')
const chooseFeed = require('./util/chooseFeed.js')

module.exports = function (bot, message, command) {
  const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0

  if (failLimit === 0) return message.channel.send(`No fail limit has been set.`)
  if (failedLinks.size() === 0) return message.channel.send(`There are no feeds that have exceeded the fail limit.`)

  chooseFeed(bot, message, command, function (rssName, msgHandler) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources
    const source = rssList[rssName]

    if (!failedLinks[source.link] || failedLinks[source.link] < failLimit) {
      msgHandler.deleteAll(message.channel)
      return message.channel.send(`Unable to refresh the feed <${rssList[rssName].link}> if it has not reached the failure limit.`)
    }

    const cookies = (source.advanced && source.advanced.cookies && source.advanced.size() > 0) ? source.advanced.cookies : undefined
    message.channel.send(`Processing request for refresh...`)
    .then(function (processing) {
      requestStream(source.link, cookies, null, function (err) {
        if (err) {
          console.log(`Commands Info: Unable to refresh feed link ${source.link}, reason: `, err)
          return processing.edit(`Unable to refresh feed ${source.link}. Reason:\n\`\`\`${err}\n\`\`\``)
        }
        delete failedLinks[source.link]

        if (bot.shard) bot.shard.broadcastEval(`delete require(require('path').dirname(require.main.filename) + '/util/storage.js').failedLinks['${source.link}'];`).catch(err => console.log(`Error: Unable to broadcast failed links update on rssrefresh. `, err.message || err))

        try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Error: Unable to update failedLinks.json from rssrefresh. Reason: ${e}`) }

        console.log(`RSS Info: Link ${source.link} has been refreshed back on cycle.`)
        msgHandler.deleteAll(message.channel)
        processing.edit(`Successfully refreshed <${source.link}>. It will now be retrieved on subsequent cycles.`)
      })
    }).catch(err => console.log(`Promise Warning: rssrefresh 1: ${err}`))
  })
}

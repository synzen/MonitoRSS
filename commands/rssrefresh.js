const config = require('../config.json')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const failedFeeds = storage.failedFeeds
const requestStream = require('../rss/request.js')
const getIndex = require('./util/printFeeds.js')

module.exports = function(bot, message, command) {
  if (failLimit === 0) return message.channel.send(`No fail limit has been set.`);
  if (failedFeeds.size() === 0) return message.channel.send(`There are no feeds that have exceeded the fail limit.`)

  getIndex(bot, message, command, function(rssName) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources
    const source = rssList[rssName]

    const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0

    if (!failedFeeds[source.link] || failedFeeds[source.link] <= failLimit) return message.channel.send('Unable to refresh a feed if it has not reached the failure limit.');



    const cookies = (source.advanced && source.advanced.cookies && source.advanced.size() > 0) ? source.advanced.cookies : undefined
    requestStream(source.link, cookies, null, function(err) {
      if (err) {
        console.log(`Commands Info: Unable to refresh feed link ${source.link}, reason: `, err);
        return message.channel.send(`Unable to refresh feed. Reason:\n\`\`\`${err}\n\`\`\``);
      }
      delete failedFeeds[source.link]
      console.log(`RSS Info: Link ${source.link} has been refreshed, and will be back on cycle.`);
      message.channel.send(`Successfully refreshed <${source.link}>.`)
    })

  })

}

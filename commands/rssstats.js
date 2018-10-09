const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const moment = require('moment')

module.exports = (bot, message) => {
  const reference = bot.shard && bot.shard.count > 0 ? storage.statisticsGlobal : storage.statistics
  if (reference.fullyUpdated !== true) return message.channel.send('More time is needed to gather enough information. Try again later.')

  const visual = new MenuUtils.Menu(message, null, { numbered: false, maxPerPage: 9 })
    .setAuthor('Statistics and Performance')
    .setDescription(`${bot.shard && bot.shard.count > 0 ? 'Note that Per Shard values are averaged\n' : ''} 
**Unique Feeds** - Number of unique feed links (duplicate links are not counted).
**Total Feeds** - Number of total feeds.
**Cycle Duration** - The time it takes to process all the unique feed links.
**Cycle Failures** - The number of failures out of the number of unique feeds per cycle. 
**Success Rate** - The rate at which unique links connect successfully per cycle. A high rate is necessary to ensure that all feeds are fetched.\n\u200b`)

  let cycleTime
  let cycleFails
  let cycleLinks
  let successRate
  let guilds
  let feeds

  if (bot.shard && bot.shard.count > 0) {
    guilds = `Per Shard: ${reference.guilds.shard.toFixed(2)}\nGlobal: ${reference.guilds.global}`
    feeds = `Per Shard: ${reference.feeds.shard.toFixed(2)}\nGlobal: ${reference.feeds.global}`
    cycleLinks = reference.cycleTime ? `Per Shard: ${reference.cycleLinks.shard.toFixed(2)}\nGlobal: ${reference.cycleLinks.global.toFixed(2)}` : 'No data available yet.'
    cycleFails = reference.cycleTime ? `Per Shard: ${reference.cycleFails.shard.toFixed(2)}\nGlobal: ${reference.cycleFails.global.toFixed(2)}` : 'No data available yet.'
    cycleTime = reference.cycleTime ? `Per Shard: ${reference.cycleTime.shard.toFixed(2)}s\nGlobal: ${reference.cycleTime.global.toFixed(2)}s` : 'No data available yet.'
    successRate = reference.cycleTime ? `Per Shard: ${((1 - reference.cycleFails.shard / reference.cycleLinks.shard) * 100).toFixed(2)}%\nGlobal: ${((1 - reference.cycleFails.global / reference.cycleLinks.global) * 100).toFixed(2)}%` : 'No data available yet.'
  } else {
    guilds = reference.guilds
    feeds = reference.feeds
    cycleLinks = reference.cycleTime ? reference.cycleLinks.toFixed(2) : 'No data available yet.'
    cycleFails = reference.cycleTime ? reference.cycleFails.toFixed(2) : 'No data available yet.'
    cycleTime = reference.cycleTime ? `${reference.cycleTime.toFixed(2)}s` : 'No data available yet.'
    successRate = reference.cycleTime ? `${((1 - reference.cycleFails / reference.cycleLinks) * 100).toFixed(2)}%` : 'No data available yet.'
  }
  visual.addOption('Servers', guilds, true)
  if (bot.shard && bot.shard.count > 0) visual.addOption('Shard Count', bot.shard.count, true).addOption(null, null, true)
  let diff = moment.duration(moment().diff(moment(reference.lastUpdated)))
  diff = diff.asMinutes() < 1 ? `Updated ${diff.asSeconds().toFixed(2)} seconds ago` : `Updated ${diff.asMinutes().toFixed(2)} minutes ago`

  visual
    .addOption('Unique Feeds', cycleLinks, true)
    .addOption('Total Feeds', feeds, true)
    .addOption('Cycle Duration', cycleTime, true)
    .addOption('Cycle Failures', cycleFails, true)
    .addOption('Success Rate', successRate, true)
    .setFooter(diff)

  if (bot.shard && bot.shard.count > 0) visual.addOption(null, null, true)

  visual.send().catch(err => {
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning(`rssstats 1`, message.guild, err))
  })
}

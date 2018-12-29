const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const moment = require('moment')
const dbOps = require('../util/dbOps.js')

module.exports = async (bot, message) => {
  try {
    const results = await dbOps.statistics.getAll()
    if ((bot.shard && bot.shard.count > results.length) || results.length === 0) return await message.channel.send('More time is needed to gather enough information. Try again later.')

    let shardCount = 0
    const aggregated = { guilds: 0, feeds: 0, cycleTime: 0, cycleFails: 0, cycleLinks: 0 }

    for (const shardStats of results) {
      ++shardCount
      aggregated.guilds += shardStats.guilds
      if (shardStats.feeds === 0) continue
      aggregated.feeds += shardStats.feeds
      aggregated.cycleTime += shardStats.cycleTime
      aggregated.cycleFails += shardStats.cycleFails
      aggregated.cycleLinks += shardStats.cycleLinks
      aggregated.lastUpdated = !aggregated.lastUpdated ? shardStats.lastUpdated : shardStats.lastUpdated > aggregated.lastUpdated ? shardStats.lastUpdated : aggregated.lastUpdated
    }

    const averaged = {
      guilds: (aggregated.guilds / shardCount).toFixed(2),
      feeds: (aggregated.feeds / shardCount).toFixed(2),
      cycleTime: (aggregated.cycleTime / shardCount).toFixed(2),
      cycleFails: (aggregated.cycleFails / shardCount).toFixed(2),
      cycleLinks: (aggregated.cycleLinks / shardCount).toFixed(2)
    }

    const visual = new MenuUtils.Menu(message, null, { numbered: false, maxPerPage: 9 })
      .setAuthor('Basic Performance Stats')
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
      guilds = `Per Shard: ${averaged.guilds}\nGlobal: ${aggregated.guilds}`
      feeds = `Per Shard: ${averaged.feeds}\nGlobal: ${aggregated.feeds}`
      cycleLinks = averaged.cycleTime ? `Per Shard: ${averaged.cycleLinks}\nGlobal: ${aggregated.cycleLinks.toFixed(2)}` : 'No data available yet.'
      cycleFails = averaged.cycleTime ? `Per Shard: ${averaged.cycleFails}\nGlobal: ${aggregated.cycleFails.toFixed(2)}` : 'No data available yet.'
      cycleTime = averaged.cycleTime ? `Per Shard: ${averaged.cycleTime}s\nGlobal: ${aggregated.cycleTime.toFixed(2)}s` : 'No data available yet.'
      successRate = averaged.cycleTime ? `Per Shard: ${((1 - averaged.cycleFails / averaged.cycleLinks) * 100).toFixed(2)}%\nGlobal: ${((1 - aggregated.cycleFails / aggregated.cycleLinks) * 100).toFixed(2)}%` : 'No data available yet.'
    } else {
      guilds = aggregated.guilds
      feeds = aggregated.feeds
      cycleLinks = aggregated.cycleTime ? aggregated.cycleLinks.toFixed(2) : 'No data available yet.'
      cycleFails = aggregated.cycleTime ? aggregated.cycleFails.toFixed(2) : 'No data available yet.'
      cycleTime = aggregated.cycleTime ? `${aggregated.cycleTime.toFixed(2)}s` : 'No data available yet.'
      successRate = aggregated.cycleTime ? `${((1 - aggregated.cycleFails / aggregated.cycleLinks) * 100).toFixed(2)}%` : 'No data available yet.'
    }
    visual.addOption('Servers', guilds, true)
    if (bot.shard && bot.shard.count > 0) visual.addOption('Shard Count', bot.shard.count, true).addOption(null, null, true)
    let diff = moment.duration(moment().diff(moment(aggregated.lastUpdated)))
    diff = diff.asMinutes() < 1 ? `Updated ${diff.asSeconds().toFixed(2)} seconds ago` : `Updated ${diff.asMinutes().toFixed(2)} minutes ago`

    visual
      .addOption('Unique Feeds', cycleLinks, true)
      .addOption('Total Feeds', feeds, true)
      .addOption('Cycle Duration', cycleTime, true)
      .addOption('Cycle Failures', cycleFails, true)
      .addOption('Success Rate', successRate, true)
      .setFooter(diff)

    if (bot.shard && bot.shard.count > 0) visual.addOption(null, null, true)

    await visual.send()
  } catch (err) {
    log.command.warning(`rssstats`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssstats 1', message.guild, err))
  }
}
